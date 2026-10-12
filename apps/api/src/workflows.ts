import type express from 'express';
import { authorize, customerView, qualityChecks, transition, type Actor, type Device, type RepairPart } from '@rebyte/domain';
import type { State } from './store';
import { storage } from './storage';
import { randomUUID } from 'node:crypto';

type Handler = (req: express.Request, res: express.Response, state: State) => unknown;
type Route = (method: 'get' | 'post' | 'patch', path: string, fn: Handler) => void;
type EventWriter = (s: State, d: Device, a: Actor, kind: string, note: string) => void;
const text = (value: unknown, label: string, limit = 1000) => {
    if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error('Enter ' + label);
    return value.trim();
};
function amount(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw Error('Use a valid amount with up to two decimals');
    return value;
}
export function registerWorkflows(route: Route, actor: (req: express.Request, s: State) => Actor, event: EventWriter) {
    function context(req: express.Request, s: State) {
        const a = actor(req, s), d = s.devices.find(d => d.id === req.params.id);
        if (!d) throw Error('Not found');
        authorize(a, d);
        if (req.method !== 'GET' && req.body.version !== d.version) throw Error('Record changed; refresh and retry');
        return { a, d };
    }
    route('get', '/staff', (req, _, s) => {
        const a = actor(req, s);
        if (!['admin', 'operations'].includes(a.role)) throw Error('Forbidden');
        return s.users.filter(u => ['technician', 'operations'].includes(u.role)).map(({ id, name, role }) => ({ id, name, role }));
    });
    route('patch', '/me/preferences', (req, _, s) => {
        const a = actor(req, s);
        if (a.role !== 'customer' || typeof req.body.whatsappOptIn !== 'boolean') throw Error('Forbidden');
        a.whatsappOptIn = req.body.whatsappOptIn;
        a.whatsappConsentAt = new Date().toISOString();
        s.audit.push({ at: a.whatsappConsentAt, actorId: a.id, action: a.whatsappOptIn ? 'whatsapp_opt_in' : 'whatsapp_opt_out' });
        // Pending messages must not be delivered after withdrawal.
        if (!a.whatsappOptIn) for (const n of s.notifications.filter(n => n.userId === a.id && n.channel === 'whatsapp' && n.status === 'pending')) n.status = 'suppressed';
        return a;
    });
    route('post', '/devices/:id/ownership', async (req, _, s) => {
        const { a, d } = context(req, s);
        if (a.role !== 'customer' || d.ownership?.status === 'approved') throw Error('Forbidden');
        const claimedSerial = text(req.body.claimedSerial, 'the laptop serial number', 120);
        const explanation = text(req.body.explanation, 'how you owned this laptop');
        if (req.body.declaration !== true) throw Error('Confirm that you are the original owner');
        const photo = String(req.body.photo || ''), match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
        if (!match || photo.length > 1500000) throw Error('Upload one JPG, PNG or WebP ownership photo, up to 1MB');
        const bytes = Buffer.from(match[2], 'base64');
        const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!valid || bytes.length > 1048576) throw Error('Invalid ownership image');
        const evidenceId = randomUUID();
        await storage.put(evidenceId, bytes);
        d.ownership = { status: 'submitted', claimedSerial, explanation, evidenceId, mime: 'image/' + match[1], submittedAt: new Date().toISOString() };
        d.identityVerified = false;
        event(s, d, a, 'ownership_submitted', 'Your ownership evidence is ready for a private review.');
        return customerView(d);
    });
    route('get', '/devices/:id/ownership/evidence', async (req, res, s) => {
        const { a, d } = context(req, s);
        if (!['customer', 'admin'].includes(a.role)) throw Error('Forbidden');
        if (!d.ownership?.evidenceId || d.ownership.evidenceId === 'demo-approved-record') throw Error('No uploaded evidence is available');
        res.setHeader('Cache-Control', 'no-store');
        const photo = 'data:' + d.ownership.mime + ';base64,' + (await storage.get(d.ownership.evidenceId)).toString('base64');
        s.audit.push({ at: new Date().toISOString(), actorId: a.id, action: 'ownership_evidence_viewed:' + d.ownership.evidenceId, deviceId: d.id });
        return { photo };
    });
    route('post', '/devices/:id/ownership/review', (req, _, s) => {
        const { a, d } = context(req, s);
        if (a.role !== 'admin') throw Error('Forbidden');
        if (d.ownership?.status !== 'submitted') throw Error('Review submitted ownership evidence first');
        if (!s.audit.some(e => e.actorId === a.id && e.deviceId === d.id && e.action === 'ownership_evidence_viewed:' + d.ownership!.evidenceId)) throw Error('Open the private evidence before recording your review');
        if (!['approved', 'rejected'].includes(req.body.status)) throw Error('Choose approve or reject');
        const reviewNote = text(req.body.note, 'a review reason');
        if (req.body.status === 'approved' && (!d.acquiredAt || !d.pickup?.collectionReceipt)) throw Error('Record the inspected collection handover before approving ownership');
        if (req.body.status === 'approved' && (!d.serial.trim() || d.serial.trim().toLowerCase() !== d.ownership.claimedSerial.toLowerCase())) throw Error('Collected device serial must match the ownership evidence');
        Object.assign(d.ownership, { status: req.body.status, reviewedAt: new Date().toISOString(), reviewedBy: a.id, reviewNote });
        d.identityVerified = req.body.status === 'approved';
        event(s, d, a, 'ownership_' + req.body.status, 'Ownership review: ' + req.body.status + '. ' + reviewNote);
        return { ok: true };
    });
    route('post', '/devices/:id/pickup/schedule', (req, _, s) => {
        const { a, d } = context(req, s);
        if (!['admin', 'operations'].includes(a.role)) throw Error('Forbidden');
        if (!['registered', 'pickup_scheduled'].includes(d.status) || d.customerClosed) throw Error('Only an open collection request can be scheduled');
        const pickupAt = text(req.body.pickupAt, 'pickup date and time', 80);
        if (!Number.isFinite(Date.parse(pickupAt)) || Date.parse(pickupAt) <= Date.now()) throw Error('Choose a future pickup time');
        const collector = s.users.find(u => u.id === req.body.collectorId && u.role === 'operations');
        if (!collector) throw Error('Choose a valid operations collector');
        d.pickupAt = new Date(pickupAt).toISOString();
        d.collectedBy = collector.id;
        d.location = text(req.body.location, 'the collection address');
        d.pickup = {};
        if (d.status === 'registered') transition(d, 'pickup_scheduled', a);
        event(s, d, a, 'pickup_scheduled', 'Pickup proposed for ' + d.pickupAt + '. Please confirm it in your YenLap space.');
        return { ok: true };
    });
    route('post', '/devices/:id/pickup/confirm', (req, _, s) => {
        const { a, d } = context(req, s);
        if (a.role !== 'customer' || d.customerClosed) throw Error('Forbidden');
        if (d.status !== 'pickup_scheduled' || !d.pickupAt || d.pickup?.confirmedAt) throw Error('No pickup is awaiting confirmation');
        if (Date.parse(d.pickupAt) <= Date.now()) throw Error('Pickup time has passed; ask operations to reschedule');
        (d.pickup ||= {}).confirmedAt = new Date().toISOString();
        event(s, d, a, 'pickup_confirmed', 'You confirmed your laptop collection slot.');
        return customerView(d);
    });
    route('post', '/devices/:id/pickup/collect', (req, _, s) => {
        const { a, d } = context(req, s);
        if (!['admin', 'operations'].includes(a.role) || (a.role === 'operations' && a.id !== d.collectedBy)) throw Error('Forbidden');
        if (d.status !== 'pickup_scheduled' || d.customerClosed || !d.pickup?.confirmedAt) throw Error('Owner confirmation is required before collection');
        d.serial = text(req.body.serial, 'the inspected serial number', 120);
        d.condition = text(req.body.condition, 'the condition at collection');
        d.purchasePrice = amount(req.body.purchasePrice);
        d.acquisitionSource = text(req.body.acquisitionSource, 'the acquisition source');
        d.pickup.collectionReceipt = text(req.body.receipt, 'the signed handover receipt reference', 200);
        d.pickup.paymentReference = text(req.body.paymentReference, 'the acquisition payment reference (or zero-value acknowledgement)', 200);
        d.acquiredAt = new Date().toISOString();
        transition(d, 'collected', a);
        event(s, d, a, 'collected', 'Your laptop has been collected. Its handover has been recorded.');
        return { ok: true };
    });
    route('post', '/devices/:id/repair', (req, _, s) => {
        const { a, d } = context(req, s);
        authorize(a, d, true);
        if (!['admin', 'technician'].includes(a.role)) throw Error('Forbidden');
        if (!['diagnosis', 'restoration_started', 'data_recovery', 'testing'].includes(d.status)) throw Error('Repair costs are editable only during diagnosis and restoration');
        d.diagnosis = text(req.body.diagnosis, 'technician diagnosis', 2000);
        if (!Array.isArray(req.body.parts) || req.body.parts.length > 30) throw Error('Use up to 30 parts');
        const parts: RepairPart[] = req.body.parts.map((p: RepairPart) => {
            if (!Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 100) throw Error('Part quantity must be 1–100');
            return { name: text(p.name, 'part name', 150), quantity: p.quantity, unitCost: amount(p.unitCost) };
        });
        d.repairParts = parts;
        d.partsCost = Math.round(parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0) * 100) / 100;
        d.labourCost = amount(req.body.labourCost);
        d.quality = undefined;
        event(s, d, a, 'repair_recorded', 'Technician diagnosis and repair work have been recorded.');
        return { ok: true };
    });
    route('post', '/devices/:id/quality', (req, _, s) => {
        const { a, d } = context(req, s);
        authorize(a, d, true);
        if (!['admin', 'technician'].includes(a.role)) throw Error('Forbidden');
        if (d.status !== 'testing') throw Error('Quality checks can be recorded only during testing');
        if (!req.body.checks || qualityChecks.some(k => typeof req.body.checks[k] !== 'boolean')) throw Error('Record every quality check');
        d.quality = { checks: Object.fromEntries(qualityChecks.map(k => [k, req.body.checks[k]])) as NonNullable<Device['quality']>['checks'], notes: text(req.body.notes, 'test observations', 2000), checkedAt: new Date().toISOString(), checkedBy: a.id };
        const passed = qualityChecks.every(k => d.quality!.checks[k]);
        event(s, d, a, passed ? 'quality_passed' : 'quality_failed', passed ? 'Your laptop passed its restoration quality checks.' : 'Testing identified an issue. Further restoration checks are needed.');
        return { passed };
    });
}

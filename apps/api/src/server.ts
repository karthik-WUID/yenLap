import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authorize, customerView, nextStages, transition, stages, ownershipVerified, type Actor, type Device, type Stage } from '@rebyte/domain';
import { transaction, type State } from './store';
import { storage } from './storage';
import { registerWorkflows } from './workflows';
import { generateOTP, messagingProvider, otpProvider } from './providers';
export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(rateLimit({ windowMs: 60000, limit: 120, skip: () => process.env.TEST_MODE === 'true' && process.env.NODE_ENV === 'test', message: { error: 'Too many requests. Please wait and retry.' } }));
if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || process.env.DEMO_MODE === 'true'))
    throw Error('Production requires database and disabled demo mode; configure real providers before deployment');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function actor(req: express.Request, s: State): Actor {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.cookie?.split('; ').find(v => v.startsWith('rebyte='))?.slice(7);
    const session = token ? s.sessions[hash(token)] : undefined;
    if (!session || session.expires < Date.now())
        throw Error('Unauthenticated');
    return s.users.find(u => u.id === session.userId)!;
}
function session(res: express.Response, s: State, u: Actor) { const token = randomBytes(32).toString('hex'); s.sessions[hash(token)] = { userId: u.id, expires: Date.now() + 86400000 }; res.cookie('rebyte', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }); return { user: u, token }; }
function event(s: State, d: Device, a: Actor, kind: string, note: string) {
    const e = { id: randomUUID(), at: new Date().toISOString(), actorId: a.id, kind, note, customerVisible: !d.customerClosed || ['returned_to_owner', 'owner_decline', 'customer_closed', 'recovery_uploaded', 'free_data_return_confirmed'].includes(kind), customerStage: d.customerClosed ? 'journey_completed' : d.status, deviceStage: d.status, businessStage: ({ registered: 'acquisition_lead', pickup_scheduled: 'collection_booked', collected: 'asset_acquired', received: 'stock_received', diagnosis: 'repair_assessment', restoration_started: 'repair_in_progress', data_recovery: 'privacy_obligation_in_progress', testing: 'quality_assurance', restored: 'restoration_complete', owner_decision_required: 'original_owner_offer', returned_to_owner: 'owner_return', refurbished_inventory: 'available_for_resale', sold: 'sale_recorded', recycling: 'recycling_pending', journey_completed: 'financial_and_device_closure' } as Record<string, string>)[d.status] };
    d.events.push(e);
    d.version++;
    if (['owner_decline', 'customer_closed'].includes(kind)) {
        const journeyEvents = new Set(d.events.map(v => v.id));
        for (const n of s.notifications.filter(n => journeyEvents.has(n.eventId) && n.channel !== 'in_app' && n.status === 'pending')) n.status = 'suppressed';
    }
    s.audit.push({ at: e.at, actorId: a.id, action: kind, deviceId: d.id });
    if (e.customerVisible)
        for (const channel of (['owner_decline', 'customer_closed'].includes(kind) ? ['in_app'] : ['in_app', 'whatsapp', 'push']))
            if (channel !== 'whatsapp' || s.users.find(u => u.id === d.ownerId)?.whatsappOptIn === true) s.notifications.push({ id: randomUUID(), eventId: e.id, userId: d.ownerId, channel, message: note, status: channel === 'in_app' ? 'delivered' : 'pending', attempts: 0, read: false });
}
function route(method: 'get' | 'post' | 'patch', path: string, fn: (req: express.Request, res: express.Response, s: State) => unknown) {
    app[method](path, async (req, res) => {
        try {
            const result = await transaction(s => fn(req, res, s));
            res.json(result);
        }
        catch (e: any) {
            const m = e.message;
            res.status(m === 'Unauthenticated' ? 401 : m === 'Forbidden' ? 403 : m === 'Not found' ? 404 : 400).json({ error: m });
        }
    });
}
registerWorkflows(route, actor, event);
function staffView(d: Device, a: Actor, s: State) {
    const view = { ...d, identityVerified: ownershipVerified(d), nextStages: nextStages(d, a), originalOwner: s.users.find(u => u.id === d.ownerId) };
    if (a.role !== 'admin' && view.ownership) view.ownership = { ...view.ownership, explanation: '', evidenceId: '', mime: '' };
    return view;
}
app.get('/health', (_, res) => res.json({ ok: true, mode: process.env.DATABASE_URL ? 'postgres' : 'local' }));
route('post', '/auth/otp/request', async (req, _, s) => {
    const phone = String(req.body.phone || '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
        throw Error('Use E.164 mobile number');
    if ((s.otps[phone]?.expires || 0) > Date.now() + 240000)
        throw Error('Wait before requesting another OTP');
    const code = generateOTP();
    await otpProvider.send(phone, code);
    s.otps[phone] = { hash: hash(phone + code), expires: Date.now() + 300000, attempts: 0 };
    return { sent: true, ...(process.env.DEMO_MODE === 'true' ? { demoCode: code } : {}) };
});
// Failed attempts must commit, so this route returns an error result instead of throwing.
route('post', '/auth/otp/verify', (req, res, s) => {
    const { phone, code } = req.body;
    const challenge = s.otps[phone];
    if (!challenge || challenge.expires < Date.now() || challenge.attempts >= 5) {
        res.status(400);
        return { error: 'OTP expired or locked' };
    }
    challenge.attempts++;
    if (challenge.hash !== hash(phone + String(code))) {
        res.status(400);
        return { error: 'Invalid OTP' };
    }
    delete s.otps[phone];
    let u = s.users.find(u => u.phone === phone);
    if (!u) {
        u = { id: randomUUID(), phone, role: 'customer', name: String(req.body.name || 'YenLap member').slice(0, 80) };
        s.users.push(u);
    }
    s.audit.push({ at: new Date().toISOString(), actorId: u.id, action: 'otp_login' });
    return session(res, s, u);
});
route('post', '/auth/demo', (req, res, s) => {
    if (process.env.DEMO_MODE !== 'true' || process.env.NODE_ENV === 'production')
        throw Error('Demo disabled');
    const u = s.users.find(u => u.role === req.body.role);
    if (!u)
        throw Error('Unknown role');
    return session(res, s, u);
});
route('post', '/auth/logout', (req, res, s) => {
    actor(req, s);
    const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.cookie?.split('; ').find(v => v.startsWith('rebyte='))?.slice(7);
    if (token)
        delete s.sessions[hash(token)];
    res.clearCookie('rebyte');
    return { ok: true };
});
route('get', '/me', (req, _, s) => actor(req, s));
route('get', '/devices', (req, _, s) => { const a = actor(req, s); return s.devices.filter(d => a.role === 'customer' ? d.ownerId === a.id : a.role === 'technician' ? d.technicianId === a.id : true).map(d => a.role === 'customer' ? { ...customerView(d), recoveryAvailable: (s.recoveries || []).some(r => r.deviceId === d.id) } : staffView(d, a, s)); });
route('post', '/devices', (req, _, s) => {
    const a = actor(req, s);
    if (a.role !== 'customer')
        throw Error('Forbidden');
    const b = req.body;
    for (const k of ['brand', 'model', 'condition', 'location'])
        if (typeof b[k] !== 'string' || !b[k].trim() || b[k].length > 1000)
            throw Error('Missing or invalid ' + k);
    if (!Array.isArray(b.photos) || b.photos.length > 4 || b.photos.some((p: any) => typeof p !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(p) || p.length > 1500000))
        throw Error('Up to four JPG/PNG/WebP photos, 1MB each');
    const d: Device = { id: 'RB-' + randomUUID().slice(0, 8), ownerId: a.id, brand: b.brand, model: b.model, condition: b.condition, location: b.location, photos: b.photos, serial: '', acquisitionSource: 'Original owner direct submission', requestedPickupAt: typeof b.requestedPickupAt === 'string' ? b.requestedPickupAt : '', pickupAt: '', collectedBy: '', technicianId: 'tech-1', acquiredAt: '', purchasePrice: 0, partsCost: 0, labourCost: 0, diagnosis: '', status: 'registered', customerClosed: false, ownerDecision: 'pending', recoveryConsent: b.recoveryConsent === true, identityVerified: false, dataStatus: 'pending', dataReturnRef: '', wipeCertificate: '', resaleBuyer: '', resalePrice: 0, disposition: '', version: 0, events: [] };
    s.devices.push(d);
    event(s, d, a, 'registered', 'Your laptop’s next chapter starts here.');
    return customerView(d);
});
route('post', '/devices/:id/action', (req, _, s) => {
    const a = actor(req, s), d = s.devices.find(d => d.id === req.params.id);
    if (!d)
        throw Error('Not found');
    authorize(a, d);
    if (req.body.version !== d.version)
        throw Error('Record changed; refresh and retry');
    const { action, value } = req.body;
    if (action === 'decision') {
        if (a.role !== 'customer' || d.customerClosed || d.status !== 'owner_decision_required' || !['reclaim', 'decline'].includes(value))
            throw Error('Forbidden');
        d.ownerDecision = value;
        if (value === 'decline')
            d.customerClosed = true;
        event(s, d, a, 'owner_' + value, value === 'reclaim' ? 'You chose to bring your laptop home.' : 'Thank you. Your journey is closed; your data return remains available.');
    }
    else if (action === 'close') {
        if (a.role !== 'customer' || d.customerClosed)
            throw Error('Forbidden');
        d.customerClosed = true;
        d.ownerDecision = 'decline';
        event(s, d, a, 'customer_closed', 'Your chapter is closed. Secure data return remains available.');
    }
    else if (action === 'consent') {
        if (a.role !== 'customer' || d.customerClosed)
            throw Error('Forbidden');
        d.recoveryConsent = value === true;
        event(s, d, a, 'consent_changed', 'Data recovery consent updated.');
    }
    else if (action === 'transition') {
        if (!stages.includes(value))
            throw Error('Invalid status');
        transition(d, value as Stage, a);
        event(s, d, a, value, value === 'restored' ? 'Your old laptop is alive again.' : String(value).replaceAll('_', ' '));
    }
    else
        throw Error('Unknown action');
    return a.role === 'customer' ? { ...customerView(d), recoveryAvailable: (s.recoveries || []).some(r => r.deviceId === d.id) } : staffView(d, a, s);
});
route('patch', '/devices/:id', (req, _, s) => {
    const a = actor(req, s), d = s.devices.find(d => d.id === req.params.id);
    if (!d)
        throw Error('Not found');
    authorize(a, d, true);
    if (req.body.version !== d.version)
        throw Error('Record changed; refresh and retry');
    const b = req.body;
    const allowed = a.role === 'technician' ? ['diagnosis', 'partsCost', 'labourCost'] : a.role === 'operations' ? ['serial', 'acquisitionSource', 'location', 'pickupAt', 'collectedBy', 'acquiredAt', 'purchasePrice', 'resaleBuyer', 'resalePrice', 'disposition'] : ['serial', 'acquisitionSource', 'location', 'pickupAt', 'collectedBy', 'acquiredAt', 'purchasePrice', 'resaleBuyer', 'resalePrice', 'disposition', 'diagnosis', 'technicianId', 'partsCost', 'labourCost', 'dataStatus', 'dataReturnRef', 'wipeCertificate'];
    for (const key of Object.keys(b)) {
        if (key === 'version')
            continue;
        if (!allowed.includes(key))
            throw Error('Forbidden');
        const v = b[key];
        if (['purchasePrice', 'partsCost', 'labourCost', 'resalePrice'].includes(key)) {
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
                throw Error('Invalid amount');
        }
        else if (key === 'identityVerified') {
            if (typeof v !== 'boolean')
                throw Error('Invalid verification');
        }
        else if (typeof v !== 'string' || v.length > 2000)
            throw Error('Invalid field');
    }
    if (['owner_decision_required', 'returned_to_owner', 'refurbished_inventory', 'sold', 'journey_completed'].includes(d.status) && ['partsCost', 'labourCost'].some(k => k in b && b[k] !== d[k as 'partsCost' | 'labourCost']))
        throw Error('Quoted restoration costs are locked after the owner offer');
    if (b.serial && d.ownership?.status === 'approved' && b.serial !== d.serial) throw Error('Approved ownership binds the collected device serial');
    if (['pickupAt', 'collectedBy', 'acquiredAt', 'purchasePrice'].some(k => k in b)) throw Error('Use the collection workflow to preserve confirmed handover records');
    if (['diagnosis', 'partsCost', 'labourCost'].some(k => k in b)) throw Error('Use the technician repair workflow for itemized costs and quality checks');
    if (b.technicianId && !s.users.some(u => u.id === b.technicianId && u.role === 'technician'))
        throw Error('Unknown technician');
    if (b.dataStatus && b.dataStatus !== d.dataStatus && !({ pending: ['none', 'recovered'], none: [], recovered: ['returned'], returned: [] } as Record<string, string[]>)[d.dataStatus].includes(b.dataStatus))
        throw Error('Data status cannot be downgraded or skip verified delivery');
    if (b.identityVerified === false && d.identityVerified && d.dataStatus !== 'pending')
        throw Error('Recovered data ownership verification cannot be revoked through this form');
    if (b.dataStatus && !['pending', 'none', 'recovered', 'returned'].includes(b.dataStatus))
        throw Error('Invalid data status');
    if (b.dataStatus === 'recovered' && (!d.recoveryConsent || !ownershipVerified(d)))
        throw Error('Recovery requires consent and verification');
    if (b.dataStatus === 'returned' && d.dataStatus !== 'returned' && (!ownershipVerified(d) || d.dataStatus !== 'recovered' || !(b.dataReturnRef || d.dataReturnRef)))
        throw Error('Record verified secure data delivery reference');
    if (b.wipeCertificate && !(b.dataStatus === 'none' || b.dataStatus === 'returned' || ['none', 'returned'].includes(d.dataStatus)))
        throw Error('Resolve data return before wiping');
    if (['refurbished_inventory', 'sold', 'journey_completed'].includes(d.status) && ['dataStatus', 'wipeCertificate'].some(k => k in b))
        throw Error('Privacy disposition records are locked');
    if (['sold', 'journey_completed'].includes(d.status) && ['resaleBuyer', 'resalePrice'].some(k => k in b))
        throw Error('Completed sale records are locked');
    Object.assign(d, Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'version')));
    event(s, d, a, 'record_updated', 'Operations record updated');
    return staffView(d, a, s);
});
route('get', '/notifications', (req, _, s) => { const a = actor(req, s); return s.notifications.filter(n => a.role === 'admin' || n.userId === a.id); });
route('get', '/audit', (req, _, s) => {
    if (actor(req, s).role !== 'admin')
        throw Error('Forbidden');
    return s.audit;
});
route('post', '/notifications/:id/read', (req, _, s) => {
    const a = actor(req, s), n = s.notifications.find(n => n.id === req.params.id && n.userId === a.id);
    if (!n)
        throw Error('Not found');
    n.read = true;
    return { ok: true };
});
route('post', '/devices/:id/recovery/upload', async (req, _, s) => {
    const a = actor(req, s);
    if (a.role !== 'admin')
        throw Error('Forbidden');
    const d = s.devices.find(d => d.id === req.params.id);
    if (!d)
        throw Error('Not found');
    if (!ownershipVerified(d) || !d.recoveryConsent || !['pending', 'recovered'].includes(d.dataStatus))
        throw Error('Recovery upload requires verified ownership, consent and unresolved recovery');
    if (typeof req.body.base64 !== 'string' || req.body.base64.length > 5600000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(req.body.base64))
        throw Error('Recovery file maximum 4MB in local MVP');
    if ((s.recoveries || []).some(r => r.deviceId === d.id))
        throw Error('A recovery archive is already available for this device');
    const bytes = Buffer.from(req.body.base64, 'base64');
    if (!bytes.length || bytes.length > 4194304)
        throw Error('Invalid recovery file');
    const fileName = String(req.body.fileName || 'recovered-data.zip').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const id = randomUUID();
    await storage.put(id, bytes);
    (s.recoveries ||= []).push({ id, deviceId: d.id, ownerId: d.ownerId, fileName, createdAt: new Date().toISOString(), downloadedAt: null });
    d.dataStatus = 'recovered';
    event(s, d, a, 'recovery_uploaded', 'Recoverable data is ready for a secure, free return.');
    return { id, fileName, free: true };
});
route('post', '/devices/:id/recovery/request', (req, _, s) => {
    const a = actor(req, s), d = s.devices.find(d => d.id === req.params.id);
    if (!d)
        throw Error('Not found');
    if (a.role !== 'customer' || d.ownerId !== a.id || !ownershipVerified(d))
        throw Error('Forbidden');
    const artifact = (s.recoveries || []).filter(r => r.deviceId === d.id && r.ownerId === a.id).at(-1);
    if (!artifact)
        throw Error('No recovered file is available yet');
    const token = randomBytes(32).toString('hex');
    (s.downloadLinks ||= {})[hash(token)] = { artifactId: artifact.id, userId: a.id, expires: Date.now() + 120000, used: false };
    s.audit.push({ at: new Date().toISOString(), actorId: a.id, action: 'secure_data_link_issued', deviceId: d.id });
    return { url: '/api/recovery/' + token, expiresInSeconds: 120, free: true };
});
app.get('/recovery/:token', async (req, res) => {
    try {
        const delivery = await transaction(async (s) => {
            const a = actor(req, s), link = s.downloadLinks?.[hash(String(req.params.token))];
            if (!link || link.userId !== a.id || link.expires < Date.now() || link.used)
                throw Error('Download expired or unavailable');
            const artifact = s.recoveries?.find(r => r.id === link.artifactId);
            if (!artifact || artifact.ownerId !== a.id)
                throw Error('Forbidden');
            const d = s.devices.find(d => d.id === artifact.deviceId)!;
            if (!ownershipVerified(d))
                throw Error('Forbidden');
            const bytes = await storage.get(artifact.id);
            link.used = true;
            artifact.downloadedAt = new Date().toISOString();
            s.audit.push({ at: artifact.downloadedAt, actorId: a.id, action: 'recovery_download_served', deviceId: d.id });
            return { bytes, fileName: artifact.fileName };
        });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="' + delivery.fileName + '"');
        res.send(delivery.bytes);
    }
    catch (e: any) {
        res.status(403).json({ error: e.message });
    }
});
route('post', '/devices/:id/recovery/confirm', (req, _, s) => {
    const a = actor(req, s), d = s.devices.find(d => d.id === req.params.id);
    if (!d)
        throw Error('Not found');
    if (a.role !== 'customer' || d.ownerId !== a.id || !ownershipVerified(d))
        throw Error('Forbidden');
    const delivered = (s.recoveries || []).filter(r => r.deviceId === d.id);
    if (!delivered.length || delivered.some(r => !r.downloadedAt))
        throw Error('Download all available recovered files before confirming');
    d.dataStatus = 'returned';
    d.dataReturnRef = 'owner-confirmed:' + a.id + ':' + new Date().toISOString();
    event(s, d, a, 'free_data_return_confirmed', 'Original owner confirmed receipt of their recovered data, free of charge.');
    return { confirmed: true };
});
let delivering = false;
const worker = setInterval(async () => {
    if (delivering)
        return;
    delivering = true;
    try {
        await transaction(async (s) => {
            for (const n of s.notifications.filter(n => n.status === 'pending' && n.attempts < 5)) {
                if (n.channel === 'whatsapp' && !s.users.find(u => u.id === n.userId)?.whatsappOptIn) { n.status = 'suppressed'; continue; }
                n.attempts++;
                try {
                    await messagingProvider.send(n.channel, s.users.find(u => u.id === n.userId)!.phone, n.message, n.eventId + ':' + n.channel);
                    n.status = process.env.NODE_ENV === 'production' ? 'delivered' : 'mock_delivered';
                }
                catch {
                    n.status = n.attempts === 5 ? 'failed' : 'pending';
                }
            }
        });
    }
    catch {
        console.error('Outbox transaction failed; will retry');
    }
    finally {
        delivering = false;
    }
}, 5000);
worker.unref();
if (process.env.TEST_MODE !== 'true')
    app.listen(Number(process.env.PORT || 4000), process.env.HOST || '127.0.0.1', () => console.log('ReByte API http://localhost:4000'));

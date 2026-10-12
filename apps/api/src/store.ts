import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { Pool } from 'pg';
import type { Actor, Device } from '@rebyte/domain';
export type Notification = {
    id: string;
    eventId: string;
    userId: string;
    channel: string;
    message: string;
    status: string;
    attempts: number;
    read: boolean;
};
export type RecoveryArtifact = {
    id: string;
    deviceId: string;
    ownerId: string;
    fileName: string;
    createdAt: string;
    downloadedAt: string | null;
};
export type State = {
    recoveries?: RecoveryArtifact[];
    downloadLinks?: Record<string, {
        artifactId: string;
        userId: string;
        expires: number;
        used: boolean;
    }>;
    users: Actor[];
    devices: Device[];
    notifications: Notification[];
    audit: {
        at: string;
        actorId: string;
        action: string;
        deviceId?: string;
    }[];
    sessions: Record<string, {
        userId: string;
        expires: number;
    }>;
    otps: Record<string, {
        hash: string;
        expires: number;
        attempts: number;
    }>;
};
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const path = process.env.DATA_FILE || './data/state.json';
export function seed(): State {
    const users: Actor[] = [{ id: 'owner-1', name: 'Karthik', phone: '+919876543210', role: 'customer', whatsappOptIn: true, whatsappConsentAt: '2026-09-29T10:00:00Z' }, { id: 'admin-1', name: 'Ananya', phone: '+919876543211', role: 'admin' }, { id: 'tech-1', name: 'Arun', phone: '+919876543212', role: 'technician' }, { id: 'ops-1', name: 'Meera', phone: '+919876543213', role: 'operations' }];
    const devices: Device[] = [{ id: 'RB-1042', ownerId: 'owner-1', brand: 'HP', model: 'Pavilion 15', serial: 'HP-DEMO-1042', acquisitionSource: 'Original owner direct collection', requestedPickupAt: '', condition: 'Not powering on. Contains family photographs.', photos: [], location: 'Adyar, Chennai', pickupAt: '2026-10-02T10:00:00+05:30', collectedBy: 'ops-1', technicianId: 'tech-1', acquiredAt: '2026-09-25', purchasePrice: 1500, partsCost: 1800, labourCost: 700, diagnosis: 'Power circuit repaired; new SSD fitted.', status: 'owner_decision_required', customerClosed: false, ownerDecision: 'pending', recoveryConsent: true, identityVerified: true, dataStatus: 'recovered', dataReturnRef: '', wipeCertificate: '', resaleBuyer: '', resalePrice: 0, disposition: '', version: 1, events: [] }];
    devices[0].ownership = { status: 'approved', claimedSerial: 'HP-DEMO-1042', explanation: 'Synthetic seed ownership review; not real identity evidence.', evidenceId: 'demo-approved-record', mime: '', submittedAt: '2026-09-29T09:00:00Z', reviewedAt: '2026-09-29T10:00:00Z', reviewedBy: 'admin-1', reviewNote: 'Explicitly approved local demonstration record.' };
    devices[0].pickup = { confirmedAt: '2026-09-25T08:00:00Z', collectionReceipt: 'DEMO-HANDOVER-1042', paymentReference: 'DEMO-ACQUISITION-1042' };
    devices[0].quality = { checks: { boot: true, display: true, keyboard: true, network: true, battery: true, storage: true }, checkedAt: '2026-09-29T09:00:00Z', checkedBy: 'tech-1', notes: 'Synthetic demonstration quality checklist.' };
    for (const status of ['registered', 'collected', 'diagnosis', 'data_recovery', 'restored', 'owner_decision_required'])
        devices[0].events.push({ id: 'seed-' + status, at: '2026-09-29T10:00:00Z', actorId: 'tech-1', kind: status, note: status === 'restored' ? 'Your old laptop is alive again.' : 'Your laptop: ' + status.replaceAll('_', ' '), customerVisible: true, customerStage: status, deviceStage: status as Device['status'], businessStage: status });
    const pickupDemo: Device = { ...structuredClone(devices[0]), id: 'RB-DEMO-PICKUP', brand: 'Dell', model: 'Latitude 5490', serial: '', condition: '[Local demo] Dead laptop awaiting an arranged pickup.', status: 'registered', acquisitionSource: 'Synthetic local walkthrough', pickupAt: '', collectedBy: '', acquiredAt: '', purchasePrice: 0, partsCost: 0, labourCost: 0, diagnosis: '', recoveryConsent: true, identityVerified: false, dataStatus: 'pending', ownership: undefined, pickup: undefined, quality: undefined, events: [] };
    pickupDemo.events.push({ id: 'seed-pickup-registered', at: '2026-09-29T10:00:00Z', actorId: 'owner-1', kind: 'registered', note: 'Synthetic demo: arrange and confirm collection to begin.', customerVisible: true, customerStage: 'registered', deviceStage: 'registered', businessStage: 'acquisition_lead' });
    const qualityDemo: Device = { ...structuredClone(devices[0]), id: 'RB-DEMO-QC', brand: 'Lenovo', model: 'ThinkPad T480', serial: 'LOCAL-DEMO-T480', condition: '[Local demo] Power circuit repaired; awaiting final QC.', status: 'testing', dataStatus: 'none', diagnosis: 'Synthetic demo: power board repaired; SSD installed.', partsCost: 1500, labourCost: 500, quality: undefined, repairParts: [{ name: 'Replacement SSD (demo)', quantity: 1, unitCost: 1200 }, { name: 'Power component (demo)', quantity: 2, unitCost: 150 }], events: [] };
    qualityDemo.ownership = { ...devices[0].ownership!, claimedSerial: qualityDemo.serial };
    qualityDemo.pickup = { confirmedAt: '2026-09-25T08:00:00Z', collectionReceipt: 'DEMO-HANDOVER-T480', paymentReference: 'DEMO-NO-REAL-PAYMENT' };
    for (const stage of ['registered', 'pickup_scheduled', 'collected', 'received', 'diagnosis', 'restoration_started', 'testing'] as const) qualityDemo.events.push({ id: 'seed-qc-' + stage, at: '2026-09-29T10:00:00Z', actorId: 'tech-1', kind: stage, note: 'Synthetic demonstration: ' + stage.replaceAll('_', ' '), customerVisible: true, customerStage: stage, deviceStage: stage, businessStage: stage });
    devices.push(pickupDemo, qualityDemo);
    return { users, devices, notifications: [], audit: [], sessions: {}, otps: {} };
}
let queue = Promise.resolve();
export async function transaction<T>(fn: (s: State) => T | Promise<T>): Promise<T> {
    let resolve!: (v: T) => void, reject!: (e: unknown) => void;
    const result = new Promise<T>((a, b) => { resolve = a; reject = b; });
    queue = queue.then(async () => {
        if (pool) {
            let c;
            try {
                c = await pool.connect();
                await c.query('BEGIN');
                await c.query('CREATE TABLE IF NOT EXISTS rebyte_state (id integer PRIMARY KEY, data jsonb NOT NULL)');
                await c.query('INSERT INTO rebyte_state VALUES (1,$1) ON CONFLICT DO NOTHING', [JSON.stringify(seed())]);
                const row = await c.query('SELECT data FROM rebyte_state WHERE id=1 FOR UPDATE');
                const s = row.rows[0].data as State;
                const value = await fn(s);
                await c.query('UPDATE rebyte_state SET data=$1 WHERE id=1', [JSON.stringify(s)]);
                await c.query('COMMIT');
                resolve(value);
            }
            catch (e) {
                if (c) await c.query('ROLLBACK').catch(() => {});
                reject(e);
            }
            finally {
                c?.release();
            }
        }
        else {
            try {
                await mkdir(path.substring(0, path.lastIndexOf('/')) || '.', { recursive: true, mode: 0o700 });
                let s: State;
                try {
                    s = JSON.parse(await readFile(path, 'utf8'));
                }
                catch (e: any) {
                    if (e.code !== 'ENOENT')
                        throw e;
                    s = seed();
                }
                const value = await fn(s);
                await writeFile(path + '.tmp', JSON.stringify(s), { mode: 0o600 });
                await rename(path + '.tmp', path);
                resolve(value);
            }
            catch (e) {
                reject(e);
            }
        }
    });
    return result;
}

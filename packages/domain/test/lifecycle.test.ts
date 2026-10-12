import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition, authorize, customerView, type Device, type Actor } from '../src/index.ts';
import { readFileSync } from 'node:fs';
const seededDevice = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8')) as Device;
const admin: Actor = { id: 'admin-1', role: 'admin', phone: '+919876543211', name: 'Admin' };
const fixture = () => structuredClone(seededDevice);
test('rejects skipped lifecycle stages', () => { assert.throws(() => transition(fixture(), 'sold', admin), /Invalid/); });
test('no inventory before the owner declines', () => { const d = fixture(); d.dataStatus = 'returned'; d.wipeCertificate = 'CERT-1'; assert.throws(() => transition(d, 'refurbished_inventory', admin), /Resale/); });
test('recovered personal data blocks resale until returned', () => { const d = fixture(); d.ownerDecision = 'decline'; d.wipeCertificate = 'CERT-1'; assert.throws(() => transition(d, 'refurbished_inventory', admin), /Resale/); });
test('storage sanitization blocks inventory even with owner decline', () => { const d = fixture(); d.ownerDecision = 'decline'; d.dataStatus = 'none'; assert.throws(() => transition(d, 'refurbished_inventory', admin), /Resale/); });
test('declined owner journey closes while device continues to inventory and sale', () => { const d = fixture(); d.ownerDecision = 'decline'; d.customerClosed = true; d.dataStatus = 'returned'; d.wipeCertificate = 'CERT-1'; transition(d, 'refurbished_inventory', admin); assert.equal(d.customerClosed, true); d.resaleBuyer = 'Verified buyer'; d.resalePrice = 12000; transition(d, 'sold', admin); transition(d, 'journey_completed', admin); assert.equal(d.status, 'journey_completed'); });
test('reclaim returns the same inventory record', () => { const d = fixture(); d.ownerDecision = 'reclaim'; const id = d.id; transition(d, 'returned_to_owner', admin); assert.equal(d.id, id); assert.equal(d.customerClosed, true); });
test('recovery needs consent and identity verification', () => {
    for (const missing of ['recoveryConsent', 'identityVerified'] as const) {
        const d = fixture();
        d.status = 'restoration_started';
        d[missing] = false;
        assert.throws(() => transition(d, 'data_recovery', admin), /consent/);
    }
});
test('customer cannot access another owner device or advance staff lifecycle', () => { const a: Actor = { ...admin, role: 'customer', id: 'attacker' }; assert.throws(() => authorize(a, fixture()), /Forbidden/); assert.throws(() => transition(fixture(), 'returned_to_owner', { ...a, id: 'owner-1' }), /Forbidden/); });
test('technicians can work only on assigned devices and cannot sell them', () => { const d = fixture(); assert.throws(() => authorize({ ...admin, role: 'technician', id: 'other' }, d), /Forbidden/); assert.throws(() => transition(d, 'refurbished_inventory', { ...admin, id: 'tech-1', role: 'technician' }), /Forbidden/); });
test('customer projection omits business costs, identity verification, buyer, sanitization and hidden events', () => {
    const d = fixture();
    d.events.push({ ...d.events[0], id: 'internal', customerVisible: false });
    const v = customerView(d);
    for (const field of ['purchasePrice', 'resaleBuyer', 'wipeCertificate', 'identityVerified', 'labourCost', 'collectedBy'])
        assert.equal(field in v, false);
    assert.equal(v.events.some(e => e.id === 'internal'), false);
    assert.equal(v.restorationCost, 2500);
});
test('recycling completion requires disposal evidence and resolved storage', () => { const d = fixture(); d.status = 'recycling'; assert.throws(() => transition(d, 'journey_completed', admin), /Recycling/); });
test('pickup scheduling requires a real time and collection requires traceability', () => { const d = fixture(); d.status = 'registered'; d.pickupAt = ''; assert.throws(() => transition(d, 'pickup_scheduled', admin), /pickup/); d.pickupAt = '2026-10-02T10:00:00+05:30'; transition(d, 'pickup_scheduled', admin); d.collectedBy = ''; assert.throws(() => transition(d, 'collected', admin), /Collector/); });

test('quality checks and structured ownership cannot be skipped',()=>{
 const d=fixture();d.status='testing';assert.throws(()=>transition(d,'restored',admin),/quality/);
 d.status='restoration_started';d.recoveryConsent=true;d.identityVerified=true;delete d.ownership;
 assert.throws(()=>transition(d,'data_recovery',admin),/verified ownership/);
});

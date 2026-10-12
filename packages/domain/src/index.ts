export type Role = 'customer' | 'admin' | 'technician' | 'operations';
export const stages = ['registered', 'pickup_scheduled', 'collected', 'received', 'diagnosis', 'restoration_started', 'data_recovery', 'testing', 'restored', 'owner_decision_required', 'returned_to_owner', 'refurbished_inventory', 'sold', 'recycling', 'journey_completed'] as const;
export type Stage = typeof stages[number];
export type Actor = {
    id: string;
    role: Role;
    phone: string;
    name: string;
    whatsappOptIn?: boolean;
    whatsappConsentAt?: string;
};
export const qualityChecks = ['boot', 'display', 'keyboard', 'network', 'battery', 'storage'] as const;
export type Ownership = { status: 'submitted' | 'approved' | 'rejected'; claimedSerial: string; explanation: string; evidenceId: string; mime: string; submittedAt: string; reviewedAt?: string; reviewedBy?: string; reviewNote?: string };
export type Pickup = { confirmedAt?: string; collectionReceipt?: string; paymentReference?: string };
export type RepairPart = { name: string; quantity: number; unitCost: number };
export type Quality = { checks: Record<typeof qualityChecks[number], boolean>; notes: string; checkedAt: string; checkedBy: string };
export type Event = {
    id: string;
    at: string;
    actorId: string;
    kind: string;
    note: string;
    customerVisible: boolean;
    customerStage: string;
    deviceStage: Stage;
    businessStage: string;
};
export type Device = {
    id: string;
    ownerId: string;
    brand: string;
    model: string;
    serial: string;
    acquisitionSource: string;
    requestedPickupAt: string;
    condition: string;
    photos: string[];
    location: string;
    pickupAt: string;
    collectedBy: string;
    technicianId: string;
    acquiredAt: string;
    purchasePrice: number;
    partsCost: number;
    labourCost: number;
    diagnosis: string;
    status: Stage;
    customerClosed: boolean;
    ownerDecision: 'pending' | 'reclaim' | 'decline';
    recoveryConsent: boolean;
    identityVerified: boolean;
    dataStatus: 'pending' | 'none' | 'recovered' | 'returned';
    dataReturnRef: string;
    wipeCertificate: string;
    resaleBuyer: string;
    resalePrice: number;
    disposition: string;
    version: number;
    events: Event[];
    ownership?: Ownership;
    pickup?: Pickup;
    repairParts?: RepairPart[];
    quality?: Quality;
};
export function ownershipVerified(d: Device) { return d.identityVerified && d.ownership?.status === 'approved'; }
export function canAdvance(a: Actor, to: Stage) {
    if (a.role === 'admin') return true;
    if (a.role === 'technician') return ['diagnosis', 'restoration_started', 'data_recovery', 'testing', 'restored', 'recycling'].includes(to);
    if (a.role === 'operations') return ['pickup_scheduled', 'collected', 'received', 'returned_to_owner', 'refurbished_inventory', 'sold', 'recycling', 'journey_completed'].includes(to);
    return false;
}
const edges: Record<Stage, Stage[]> = { registered: ['pickup_scheduled'], pickup_scheduled: ['collected'], collected: ['received'], received: ['diagnosis'], diagnosis: ['restoration_started', 'recycling'], restoration_started: ['data_recovery', 'testing', 'recycling'], data_recovery: ['testing', 'recycling'], testing: ['restored', 'restoration_started', 'recycling'], restored: ['owner_decision_required'], owner_decision_required: ['returned_to_owner', 'refurbished_inventory'], returned_to_owner: ['journey_completed'], refurbished_inventory: ['sold', 'recycling'], sold: ['journey_completed'], recycling: ['journey_completed'], journey_completed: [] };
export function authorize(actor: Actor, d: Device, write = false) {
    if (actor.role === 'customer' && (d.ownerId !== actor.id || write))
        throw new Error('Forbidden');
    if (actor.role === 'technician' && d.technicianId !== actor.id)
        throw new Error('Forbidden');
}
export function transition(d: Device, to: Stage, a: Actor) {
    authorize(a, d, true);
    if (!edges[d.status].includes(to))
        throw new Error('Invalid lifecycle transition');
    if (!canAdvance(a, to))
        throw new Error('Forbidden');
    if (to === 'pickup_scheduled' && (!d.pickupAt || !d.location || !Number.isFinite(Date.parse(d.pickupAt))))
        throw new Error('A valid pickup date and location are required');
    if (to === 'collected' && (!d.collectedBy || !d.acquiredAt))
        throw new Error('Collector and acquisition date are required');
    if (to === 'pickup_scheduled' && (!d.collectedBy || d.customerClosed))
        throw new Error('Assign a collector to an open pickup request');
    if (to === 'collected' && (!d.pickup?.confirmedAt || !d.pickup.collectionReceipt || !d.pickup.paymentReference))
        throw new Error('Owner pickup confirmation, collection receipt and payment reference are required');
    if (to === 'restoration_started' && !d.diagnosis.trim())
        throw new Error('Record technician diagnosis before restoration');
    if (to === 'data_recovery' && (!d.recoveryConsent || !ownershipVerified(d)))
        throw new Error('Recovery requires consent and verified ownership');
    if (to === 'restored' && (!d.quality || qualityChecks.some(k => d.quality!.checks[k] !== true)))
        throw new Error('All quality checks must pass before restoration is complete');
    if (to === 'owner_decision_required' && !ownershipVerified(d))
        throw new Error('Verify original ownership before making the reclaim offer');
    if (to === 'restoration_started') d.quality = undefined;
    if (to === 'returned_to_owner' && d.ownerDecision !== 'reclaim')
        throw new Error('Owner must choose reclaim');
    if (to === 'returned_to_owner' && !ownershipVerified(d))
        throw new Error('Return requires verified original ownership');
    if (to === 'refurbished_inventory' && (d.ownerDecision !== 'decline' || !d.wipeCertificate || !['none', 'returned'].includes(d.dataStatus)))
        throw new Error('Resale requires owner decline, resolved data return and sanitization certificate');
    if (to === 'sold' && (!d.resaleBuyer || d.resalePrice <= 0))
        throw new Error('Buyer and sale price required');
    if (to === 'journey_completed' && d.status === 'recycling' && (!d.disposition || !d.wipeCertificate || !['none', 'returned'].includes(d.dataStatus)))
        throw new Error('Recycling requires disposition, data resolution and sanitization');
    d.status = to;
    if (['returned_to_owner', 'sold', 'journey_completed'].includes(to))
        d.customerClosed = true;
}
export function customerView(d: Device) { const { ownerId, brand, model, condition, photos, status, customerClosed, ownerDecision, recoveryConsent, dataStatus, id, pickupAt, requestedPickupAt, location, partsCost, labourCost, version } = d; return { ownerId, brand, model, condition, photos, status: customerClosed ? 'journey_completed' : status, customerClosed, ownerDecision, recoveryConsent, dataStatus, id, pickupAt, requestedPickupAt, location, restorationCost: partsCost + labourCost, version, pickupConfirmed: !!d.pickup?.confirmedAt, ownershipStatus: d.ownership?.status || 'not_submitted', ownershipReviewNote: d.ownership?.reviewNote || '', events: d.events.filter(e => e.customerVisible) }; }
export function nextStages(d: Device, a?: Actor) { return edges[d.status].filter(to => !a || canAdvance(a, to)); }

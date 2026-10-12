'use client';
import { useState, type FormEvent } from 'react';
import { Plus, ShieldCheck, Truck, Wrench, ClipboardCheck } from 'lucide-react';

type Props = {
    device: any; user: { id: string; role: string }; staff: { id: string; name: string; role: string }[];
    busy: boolean; run: (fn: () => Promise<any>) => Promise<void>;
    api: (path: string, method?: string, body?: unknown) => Promise<any>; refresh: () => Promise<void>;
};
const label = (s: string) => s.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
async function readPhoto(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1048576) throw Error('Use a JPG, PNG or WebP photo up to 1MB');
    return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}
export default function DeviceWorkflows({ device: d, user, staff, busy, run, api, refresh }: Props) {
    const [photo, setPhoto] = useState(''), [evidence, setEvidence] = useState('');
    const [parts, setParts] = useState<{ name: string; quantity: number; unitCost: number }[]>(d.repairParts || (d.partsCost ? [{ name: 'Existing recorded parts', quantity: 1, unitCost: d.partsCost }] : []));
    const customer = user.role === 'customer', admin = user.role === 'admin', ops = admin || user.role === 'operations', tech = admin || user.role === 'technician';
    const ownershipStatus = d.ownershipStatus || d.ownership?.status || 'not_submitted';
    async function submit(e: FormEvent<HTMLFormElement>, path: string, extra: (f: FormData) => object = () => ({})) {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        await run(async () => { await api('/devices/' + d.id + path, 'POST', { ...Object.fromEntries(f), ...extra(f), version: d.version }); await refresh(); });
    }
    return <div className="workflow-grid">
        {(customer || admin) && <section className="panel workflow-card"><div className="workflow-heading"><ShieldCheck size={22}/><div><h2>Ownership verification</h2><span className="badge">{label(ownershipStatus)}</span></div></div>
            <p>Your login verifies your phone. This separate review connects you to the original laptop before private data can be released.</p>
            {customer && ownershipStatus !== 'approved' && <form onSubmit={e => submit(e, '/ownership', f => ({ photo, declaration: f.get('declaration') === 'on' }))}>
                <label>Laptop serial number<input name="claimedSerial" required maxLength={120} placeholder="From the serial sticker or purchase invoice"/></label>
                <label>How did you own this laptop?<textarea name="explanation" required maxLength={1000} placeholder="Purchase details, past use, or a description of your ownership evidence"/></label>
                <label>Ownership evidence photo<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => { const file = e.target.files?.[0]; setPhoto(''); if (file) run(async () => setPhoto(await readPhoto(file))); }}/></label>
                <small>Upload the serial sticker or purchase proof. Avoid unrelated personal documents. Evidence is encrypted and available only to you and authorized admin reviewers.</small>
                <label className="checkbox"><input name="declaration" type="checkbox" required/> I confirm this is my laptop and these ownership details are accurate.</label>
                <button className="button green" disabled={busy || !photo}>{ownershipStatus === 'submitted' ? 'Replace submitted evidence' : 'Submit for private review'}</button>
            </form>}
            {(d.ownershipReviewNote || d.ownership?.reviewNote) && <p className="notice">Review: {d.ownershipReviewNote || d.ownership?.reviewNote}</p>}
            {admin && d.ownership?.status === 'submitted' && <><dl><dt>Claimed serial</dt><dd>{d.ownership.claimedSerial}</dd><dt>Collected serial</dt><dd>{d.serial || 'Awaiting inspection'}</dd></dl><p>{d.ownership.explanation}</p>
                <button className="button outline" disabled={busy} onClick={() => run(async () => { const r = await api('/devices/' + d.id + '/ownership/evidence'); setEvidence(r.photo); })}>Open private evidence</button>
                {evidence && <div className="private-evidence"><img src={evidence} alt="Private ownership evidence for admin review"/><button className="text-link" onClick={() => setEvidence('')}>Hide evidence</button></div>}
                <form onSubmit={e => submit(e, '/ownership/review')}><label>Review decision<select name="status"><option value="approved">Approve ownership</option><option value="rejected">Request corrected evidence</option></select></label><label>Reason shared with the owner<textarea name="note" required maxLength={1000}/></label><button className="button green" disabled={busy || !evidence}>Record reviewed decision</button></form></>}
        </section>}
        {(ops || (customer && d.status === 'pickup_scheduled')) && <section className="panel workflow-card"><div className="workflow-heading"><Truck size={22}/><h2>Collection & handover</h2></div>
            {customer && <><p>Proposed collection: {new Date(d.pickupAt).toLocaleString()} at {d.location}.</p><p className="notice">{d.pickupConfirmed ? 'Your pickup slot is confirmed.' : 'Confirm this slot when it works for you. Contact YenLap if it needs to change.'}</p>{!d.pickupConfirmed && !d.customerClosed && <button className="button green" disabled={busy} onClick={() => run(async () => { await api('/devices/' + d.id + '/pickup/confirm', 'POST', { version: d.version }); await refresh(); })}>Confirm my pickup</button>}</>}
            {ops && ['registered', 'pickup_scheduled'].includes(d.status) && !d.customerClosed && <form onSubmit={e => submit(e, '/pickup/schedule', f => ({ pickupAt: new Date(String(f.get('pickupAt'))).toISOString() }))}>
                <div className="form-grid"><label>Pickup date & time<input name="pickupAt" type="datetime-local" required/></label><label>Assigned collector<select name="collectorId" defaultValue={d.collectedBy || ''} required><option value="">Choose collector</option>{staff.filter(u => u.role === 'operations').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Collection address<textarea name="location" defaultValue={d.location} required maxLength={1000}/></label></div>
                <small>A new proposal resets owner confirmation.</small><button className="button green" disabled={busy}>{d.status === 'registered' ? 'Propose pickup slot' : 'Reschedule pickup'}</button>
            </form>}
            {ops && d.status === 'pickup_scheduled' && <><p className="notice">{d.pickup?.confirmedAt ? 'Owner confirmed · ' + new Date(d.pickup.confirmedAt).toLocaleString() : 'Waiting for owner confirmation'}</p>
                {(admin || d.collectedBy === user.id) && d.pickup?.confirmedAt && !d.customerClosed && <form onSubmit={e => submit(e, '/pickup/collect', f => ({ purchasePrice: Number(f.get('purchasePrice')) }))}>
                    <div className="form-grid"><label>Inspected serial number<input name="serial" defaultValue={d.serial} required maxLength={120}/></label><label>Condition at collection<textarea name="condition" defaultValue={d.condition} required/></label><label>Acquisition source<input name="acquisitionSource" defaultValue={d.acquisitionSource} required/></label><label>Amount paid to owner (₹)<input name="purchasePrice" type="number" min="0" step="0.01" required/></label><label>Signed handover receipt reference<input name="receipt" required maxLength={200}/></label><label>Payment reference / zero-value acknowledgement<input name="paymentReference" required maxLength={200}/></label></div>
                    <small>These are manually recorded references. This form does not transfer money or verify bank settlement.</small><button className="button green" disabled={busy}>Record handover & collection</button>
                </form>}</>}
            {ops && d.pickup?.collectionReceipt && <dl><dt>Handover receipt</dt><dd>{d.pickup.collectionReceipt}</dd><dt>Acquisition payment reference</dt><dd>{d.pickup.paymentReference}</dd><dt>Collected by</dt><dd>{staff.find(u => u.id === d.collectedBy)?.name || d.collectedBy}</dd><dt>Acquired at</dt><dd>{new Date(d.acquiredAt).toLocaleString()}</dd></dl>}
            {ops && d.customerClosed && !d.acquiredAt && <p>This request closed before handover. Collection is no longer available.</p>}
        </section>}
        {tech && <section className="panel workflow-card"><div className="workflow-heading"><Wrench size={22}/><h2>Diagnosis & repair costs</h2></div>
            {['diagnosis', 'restoration_started', 'data_recovery', 'testing'].includes(d.status) ? <form onSubmit={e => submit(e, '/repair', f => ({ parts, labourCost: Number(f.get('labourCost')) }))}>
                <label>Technician diagnosis<textarea name="diagnosis" defaultValue={d.diagnosis} required maxLength={2000}/></label>
                <div className="parts-list">{parts.map((part, i) => <div className="part-row" key={i}><label>Part<input value={part.name} required maxLength={150} onChange={e => setParts(parts.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}/></label><label>Quantity<input type="number" min="1" max="100" value={part.quantity} onChange={e => setParts(parts.map((p, j) => j === i ? { ...p, quantity: Number(e.target.value) } : p))}/></label><label>Unit cost (₹)<input type="number" min="0" step="0.01" value={part.unitCost} onChange={e => setParts(parts.map((p, j) => j === i ? { ...p, unitCost: Number(e.target.value) } : p))}/></label><button className="text-link" type="button" aria-label={'Remove part ' + (i + 1)} onClick={() => setParts(parts.filter((_, j) => j !== i))}>Remove</button></div>)}</div>
                <button type="button" className="button outline" disabled={parts.length >= 30} onClick={() => setParts([...parts, { name: '', quantity: 1, unitCost: 0 }])}><Plus size={16}/> Add repair part</button>
                <label>Labour cost (₹)<input name="labourCost" type="number" min="0" step="0.01" defaultValue={d.labourCost} required/></label><p>Parts total: ₹{parts.reduce((s, p) => s + p.quantity * p.unitCost, 0).toFixed(2)}. Editing repair work clears previous QC approval.</p><button className="button green" disabled={busy}>Save diagnosis & itemized costs</button>
            </form> : <><p>{d.diagnosis || 'Move this assigned device into diagnosis to record repair work.'}</p>{d.repairParts?.map((p: any, i: number) => <p key={i}>{p.name} · {p.quantity} × ₹{p.unitCost}</p>)}<p>Parts ₹{d.partsCost || 0} · Labour ₹{d.labourCost || 0}</p></>}
        </section>}
        {tech && <section className="panel workflow-card"><div className="workflow-heading"><ClipboardCheck size={22}/><h2>Restoration quality checks</h2></div><p>Record actual test observations. Every check must pass before the device can be marked restored.</p>
            {d.status === 'testing' ? <form onSubmit={e => submit(e, '/quality', f => ({ checks: Object.fromEntries(['boot', 'display', 'keyboard', 'network', 'battery', 'storage'].map(k => [k, f.get(k) === 'on'])) }))}>
                <div className="qc-checks">{['boot', 'display', 'keyboard', 'network', 'battery', 'storage'].map(k => <label className="checkbox" key={k}><input name={k} type="checkbox" defaultChecked={d.quality?.checks[k] || false}/>{label(k)} passed</label>)}</div><label>Test observations<textarea name="notes" defaultValue={d.quality?.notes || ''} required maxLength={2000}/></label><button className="button green" disabled={busy}>Record test results</button>
            </form> : <>{d.quality ? <><dl>{Object.entries(d.quality.checks).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{v ? 'Passed' : 'Needs attention'}</dd></div>)}</dl><p>{d.quality.notes}</p></> : <p>Quality testing is available when the device reaches the testing stage.</p>}</>}
        </section>}
    </div>;
}

"use client";
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import Brand from '../../components/Brand';
import { ArrowUpRight, LayoutDashboard, Laptop, Bell, ShieldCheck, LogOut, Plus, ChevronRight, Leaf, Check, Heart, RefreshCw } from 'lucide-react';
import DeviceWorkflows from '../../components/DeviceWorkflows';
type User = {
    whatsappOptIn?: boolean;
    id: string;
    name: string;
    role: string;
    phone: string;
};
type Device = {
    id: string;
    brand: string;
    model: string;
    condition: string;
    location: string;
    photos: string[];
    status: string;
    customerClosed: boolean;
    ownerDecision: string;
    dataStatus: string;
    recoveryConsent: boolean;
    version: number;
    events: any[];
    nextStages?: string[];
    [k: string]: any;
};
async function api(path: string, method = 'GET', body?: unknown) {
    const r = await fetch('/api' + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json();
    if (!r.ok)
        throw Error(data.error || 'Request failed');
    return data;
}
const title = (s: string) => s.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const money = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
export default function Workspace() {
    const [user, setUser] = useState<User | null>(null), [devices, setDevices] = useState<Device[]>([]), [selected, setSelected] = useState<string>(''), [tab, setTab] = useState('overview'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [phone, setPhone] = useState('+919876543210'), [code, setCode] = useState(''), [sent, setSent] = useState(false), [demoCode, setDemoCode] = useState(''), [notes, setNotes] = useState<any[]>([]), [audit, setAudit] = useState<any[]>([]), [adding, setAdding] = useState(false), [photos, setPhotos] = useState<string[]>([]), [timeline, setTimeline] = useState('customer');
    const [staffUsers, setStaffUsers] = useState<{id: string; name: string; role: string}[]>([]);
    const active = devices.find(d => d.id === selected) || devices[0];
    async function load() {
        const me = await api('/me');
        setUser(me);
        if (['admin', 'operations'].includes(me.role)) setStaffUsers(await api('/staff')); else setStaffUsers([]);
        setDevices(await api('/devices'));
        setNotes(await api('/notifications'));
        if (me.role === 'admin')
            setAudit(await api('/audit'));
    }
    useEffect(() => { load().catch(() => { }); }, []);
    async function run(fn: () => Promise<any>) {
        setBusy(true);
        setError('');
        try {
            await fn();
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    async function action(action: string, value?: any) {
        if (!active)
            return;
        await api('/devices/' + active.id + '/action', 'POST', { action, value, version: active.version });
        await load();
    }
    async function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const body: any = { version: active.version };
        for (const [k, v] of form.entries())
            body[k] = ['purchasePrice', 'partsCost', 'labourCost', 'resalePrice'].includes(k) ? Number(v) : k === 'identityVerified' ? v === 'true' : v;
        for (const k of Object.keys(body)) {
            if (k !== 'version' && body[k] === active[k])
                delete body[k];
        }
        await run(async () => { await api('/devices/' + active.id, 'PATCH', body); await load(); });
    }
    async function register(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); await run(async () => { const d = await api('/devices', 'POST', { ...Object.fromEntries(f), photos, recoveryConsent: f.get('recoveryConsent') === 'on' }); setSelected(d.id); setAdding(false); setPhotos([]); await load(); }); }
    if (!user)
        return <div className="login-page"><Link className="logo" href="/" aria-label="YenLap home"><Brand /></Link><div className="login-card"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>Welcome home.</h1><p>A verified mobile number connects you to your laptop’s journey.</p><form onSubmit={e => {
                e.preventDefault();
                run(async () => {
                    if (!sent) {
                        const r = await api('/auth/otp/request', 'POST', { phone });
                        setSent(true);
                        setDemoCode(r.demoCode || '');
                    }
                    else {
                        await api('/auth/otp/verify', 'POST', { phone, code });
                        await load();
                    }
                });
            }}><label>Mobile number<input value={phone} onChange={e => setPhone(e.target.value)} disabled={sent} placeholder="+919876543210" required/></label>{sent && <label>One-time code<input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} required maxLength={6}/></label>}{demoCode && <p className="notice">Local demo code: {demoCode}</p>}<button className="button green" disabled={busy}>{sent ? 'Verify & continue' : 'Send verification code'} <ArrowUpRight size={17}/></button></form>{sent && <button className="text-link" onClick={() => { setSent(false); setCode(''); }}>Change number</button>}{process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && <div className="demo-roles"><small>EXPLORE THE LOCAL DEMO</small>{['customer', 'admin', 'technician', 'operations'].map(role => <button key={role} disabled={busy} onClick={() => run(async () => { await api('/auth/demo', 'POST', { role }); await load(); })}>{title(role)}</button>)}</div>}{error && <p role="alert" className="error">{error}</p>}<span className="secure"><ShieldCheck size={15}/> Your data stays yours.</span></div></div>;
    const staff = user.role !== 'customer';
    return <div className="workspace"><aside className="sidebar"><Link className="logo" href="/" aria-label="YenLap home"><Brand /></Link><span className="workspace-label">{staff ? 'OPERATIONS WORKSPACE' : 'YOUR YENLAP SPACE'}</span><nav>{[['overview', 'Overview', LayoutDashboard], ['devices', staff ? 'Device inventory' : 'My laptops', Laptop], ['notifications', 'Notifications', Bell], ...(user.role === 'admin' ? [['audit', 'Audit history', ShieldCheck]] : [])].map(([key, label, Icon]: any) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => { setTab(key); setAdding(false); }}><Icon size={18}/>{label}{key === 'notifications' && notes.filter(n => !n.read && n.channel === 'in_app').length > 0 && <span className="count">{notes.filter(n => !n.read && n.channel === 'in_app').length}</span>}</button>)}</nav><div className="sidebar-bottom"><Leaf size={22}/><p>Small acts.<br /><strong>Lasting possibilities.</strong></p><div className="user"><div className="avatar">{user.name[0]}</div><div><strong>{user.name}</strong><small>{title(user.role)}</small></div><button aria-label="Log out" onClick={() => run(async () => { await api('/auth/logout', 'POST'); setUser(null); })}><LogOut size={17}/></button></div></div></aside>
    <div className="workspace-main"><header className="workspace-header"><span>{staff ? 'Operations' : 'Your journey'} <ChevronRight size={14}/> {title(tab)}</span><div><button className="icon-button" aria-label="Refresh" disabled={busy} onClick={() => run(load)}><RefreshCw size={16}/></button><span className="live"><i /> Connected</span><button className="icon-button mobile-logout" aria-label="Log out" onClick={() => run(async () => { await api('/auth/logout', 'POST'); setUser(null); })}><LogOut size={16}/></button></div></header><div className="workspace-content">{error && <div role="alert" className="error">{error}</div>}<div className="page-heading"><div><span className="eyebrow">{staff ? 'MAKE EVERY SECOND LIFE COUNT' : 'A LITTLE CARE GOES A LONG WAY'}</span><h1>{staff ? 'Every device. Every chapter.' : `Hello, ${user.name.split(' ')[0]}.`}<span className="green-text">{staff ? '' : ' ☀'}</span></h1><p>{staff ? 'Track restoration, protect memories, and keep your operations moving.' : 'Your old laptop has a future. Follow its story here.'}</p></div>{!staff && <button className="button dark" onClick={() => { setAdding(true); setTab('devices'); }}><Plus size={17}/> Register a laptop</button>}</div>
        {adding ? <form className="panel registration" onSubmit={register}><h2>Tell us its story.</h2><div className="form-grid">{['brand', 'model', 'condition', 'location'].map(k => <label key={k}>{title(k)}<input name={k} required maxLength={1000} placeholder={k === 'location' ? 'Pickup address and locality' : ''}/></label>)}<label>Preferred pickup date<input type="datetime-local" name="requestedPickupAt"/></label><label>Condition photos (up to 4)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => run(async () => {
                const files = Array.from(e.target.files || []);
                if (files.length > 4 || files.some(f => f.size > 1000000))
                    throw Error('Maximum 4 photos of 1MB each');
                setPhotos(await Promise.all(files.map(f => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(f); }))));
            })}/></label></div><label className="checkbox"><input type="checkbox" name="recoveryConsent"/> I consent to recovery of my personal data after YenLap verifies ownership. Recoverable data will be returned securely, free of charge.</label><div className="actions"><button className="button green" disabled={busy}>Register laptop <ArrowUpRight size={16}/></button><button type="button" className="button outline" onClick={() => setAdding(false)}>Cancel</button></div></form> :
            tab === 'notifications' ? <div className="panel"><h2>Your updates</h2>{user.role === 'customer' && <div className="notification-preferences"><h3>WhatsApp journey updates</h3><p>Receive pickup, restoration, owner-offer and secure data-return updates at {user.phone}. You can withdraw permission here anytime. In-app updates remain available.</p><label className="checkbox"><input type="checkbox" checked={user.whatsappOptIn === true} disabled={busy} onChange={e => { const whatsappOptIn = e.target.checked; run(async () => { await api('/me/preferences', 'PATCH', { whatsappOptIn }); await load(); }); }}/> I agree to receive YenLap journey updates on WhatsApp.</label><small>Local development simulates WhatsApp delivery. Live messaging requires provider onboarding and approved templates.</small></div>}{!notes.length && <p>No updates yet. Major journey events will appear here.</p>}{notes.map(n => <div className="notification" key={n.id}><Bell size={20}/><div><strong>{n.message}</strong><p>{title(n.channel)} · {n.status} · {n.attempts} delivery attempts</p></div>{!n.read && n.channel === 'in_app' && <button className="button outline" onClick={() => run(async () => { await api('/notifications/' + n.id + '/read', 'POST'); await load(); })}>Mark read</button>}</div>)}</div> :
                tab === 'audit' ? <div className="panel"><h2>Accountability, at every step.</h2><div className="table-scroll"><table><thead><tr><th>When</th><th>Actor</th><th>Device</th><th>Action</th></tr></thead><tbody>{audit.slice().reverse().map((a, i) => <tr key={i}><td>{new Date(a.at).toLocaleString()}</td><td>{a.actorId}</td><td>{a.deviceId || '—'}</td><td>{title(a.action)}</td></tr>)}</tbody></table></div></div> :
                    <><div className="stats">{(staff ? [['Devices in care', devices.length], ['Ready for a decision', devices.filter(d => d.status === 'owner_decision_required').length], ['In refurbished inventory', devices.filter(d => d.status === 'refurbished_inventory').length], ['Realized resale margin', money(devices.filter(d => ['sold', 'journey_completed'].includes(d.status) && d.resalePrice > 0).reduce((t, d) => t + d.resalePrice - d.purchasePrice - d.partsCost - d.labourCost, 0))]] : [['Laptops with YenLap', devices.length], ['Chapters in progress', devices.filter(d => !d.customerClosed).length], ['Ready to come home', devices.filter(d => d.status === 'owner_decision_required').length]]).map(([k, v]) => <div className="stat" key={k}><span>{k}</span><strong>{v}</strong><span className="stat-line"/></div>)}</div>
                    <div className="device-picker">{devices.map(d => <button className={active?.id === d.id ? 'active' : ''} key={d.id} onClick={() => setSelected(d.id)}><Laptop size={17}/>{d.brand} {d.model}<small>{d.id}</small></button>)}</div>
                        {!active ? <div className="panel"><h2>A new chapter starts here.</h2><p>Register your first laptop to begin its YenLap journey.</p></div> : <><div className="device-layout"><section className="panel device-panel"><div className="panel-heading"><span className="eyebrow">{active.id} · YOUR DEVICE’S STORY</span><span className="badge">{title(active.status)}</span></div><div className="device-summary"><div className="mini-laptop">{active.photos[0] ? <img src={active.photos[0]} alt="Registered laptop"/> : <Laptop size={76} strokeWidth={1}/>}</div><div><h2>{active.brand} {active.model}</h2><p>{active.condition}</p><span className="location">{active.location}</span>{staff && active.originalOwner && <p>Original owner: {active.originalOwner.name} · {active.originalOwner.phone}<br />Acquired from: {active.acquisitionSource || 'Original owner'}</p>}{active.requestedPickupAt && !active.pickupAt && <p>Preferred pickup: {new Date(active.requestedPickupAt).toLocaleString()} · awaiting confirmation</p>}{active.pickupAt && <p>Pickup: {new Date(active.pickupAt).toLocaleString()}</p>}</div></div>
                        {!staff && active.status === 'owner_decision_required' && !active.customerClosed && <div className="restored-card"><span className="eyebrow"><Heart size={14}/> THE MOMENT WE HOPED FOR</span><h2>Your laptop is alive again.</h2><p>Before its next chapter, you get the first choice. Bring it home for {money(active.restorationCost)} in restoration costs.</p><div className="actions"><button className="button green" disabled={busy} onClick={() => run(() => action('decision', 'reclaim'))}>Bring my laptop home <Heart size={16}/></button><button className="button outline" disabled={busy} onClick={() => run(() => action('decision', 'decline'))}>Let it begin a new life</button></div>{active.ownerDecision === 'reclaim' && <p className="notice">Your choice is recorded. YenLap will arrange payment and return with you.</p>}</div>}
                        {active.customerClosed && <div className="notice">{active.ownerDecision === 'reclaim' ? 'Your laptop’s journey is complete. Welcome home.' : 'Your chapter is closed. Thank you for giving this laptop a second chance.'} Eligible data return remains available through YenLap.</div>}
                        <div className="timeline-tabs">{(staff ? ['customer', 'device', 'business'] : ['customer']).map(t => <button key={t} className={timeline === t ? 'active' : ''} onClick={() => setTimeline(t)}>{title(t)} journey</button>)}</div><div className="timeline">{active.events.filter(e => timeline !== 'customer' || e.customerVisible).slice().reverse().map(e => <div className="timeline-event" key={e.id}><span className="timeline-dot"><Check size={12}/></span><div><strong>{title(timeline === 'customer' ? e.customerStage : timeline === 'device' ? e.deviceStage : e.businessStage)}</strong><p>{e.note}</p><small>{new Date(e.at).toLocaleString()}</small></div></div>)}</div></section>
                        <aside className="detail-aside"><div className="panel privacy-card"><ShieldCheck className="green-text" size={26}/><h3>Your memories, protected.</h3><p>Recovered data is returned securely to the verified owner at no cost.</p>{!staff && active.recoveryAvailable && <div className="recovery-actions"><button className="button green" disabled={busy} onClick={() => run(async () => { const r = await api('/devices/' + active.id + '/recovery/request', 'POST', {}); window.location.assign(r.url); })}>Download recovered data · Free</button><button className="text-link" disabled={busy} onClick={() => run(async () => { await api('/devices/' + active.id + '/recovery/confirm', 'POST', {}); await load(); })}>I have received my data securely</button></div>}<dl><dt>Data recovery</dt><dd>{title(active.dataStatus)}</dd><dt>Recovery consent</dt><dd>{active.recoveryConsent ? 'Granted' : 'Not granted'}</dd>{staff && <><dt>Owner verification</dt><dd>{active.identityVerified ? 'Verified' : 'Pending'}</dd><dt>Sanitization</dt><dd>{active.wipeCertificate || 'Pending'}</dd><dt>Owner decision</dt><dd>{title(active.ownerDecision)}</dd></>}</dl>{!staff && !active.customerClosed && <button className="text-link" disabled={busy} onClick={() => run(() => action('consent', !active.recoveryConsent))}>{active.recoveryConsent ? 'Withdraw' : 'Grant'} recovery consent</button>}</div><div className="panel"><Leaf size={25} className="green-text"/><h3>A future worth restoring.</h3><p>Every laptop we restore is one more device kept in use.</p>{!staff && !active.customerClosed && <button className="text-link" disabled={busy} onClick={() => run(() => action('close'))}>Close my journey</button>}</div>{staff && <div className="panel"><h3>Move the journey forward</h3><p>Backend checks ownership, privacy gates and your role.</p>{active.nextStages?.filter(stage => !['pickup_scheduled', 'collected'].includes(stage)).map(stage => <button key={stage} className="stage-button" disabled={busy} onClick={() => run(() => action('transition', stage))}>{title(stage)} <ChevronRight size={16}/></button>)}</div>}</aside></div>
                        <DeviceWorkflows key={active.id + ':' + active.version} device={active} user={user} staff={staffUsers} busy={busy} run={run} api={api} refresh={load}/>{user.role === 'admin' && <div className="panel operations-form"><h2>Secure recovered data return</h2><p>After reviewing ownership and consent, upload a recovered ZIP or file (up to 4MB for the local demo). It is encrypted at rest and downloadable only by the verified original owner.</p><input aria-label="Recovered file" type="file" disabled={busy || !active.identityVerified || !active.recoveryConsent} onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                        run(async () => {
                                            if (file.size > 4194304)
                                                throw Error('Local recovery upload limit: 4MB');
                                            const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
                                            await api('/devices/' + active.id + '/recovery/upload', 'POST', { fileName: file.name, base64 });
                                            await load();
                                        });
                                }}/></div>}{staff && user.role !== 'technician' && <form className="panel operations-form" onSubmit={save} key={active.id + active.version}><h2>Operations record</h2><p>All changes are recorded in the audit history.</p><div className="form-grid">{(user.role === 'technician' ? [] : user.role === 'operations' ? ['serial', 'acquisitionSource', 'location', 'resaleBuyer', 'resalePrice', 'disposition'] : ['serial', 'acquisitionSource', 'location', 'technicianId', 'dataReturnRef', 'wipeCertificate', 'resaleBuyer', 'resalePrice', 'disposition']).map(k => <label key={k}>{title(k.replace(/([A-Z])/g, ' $1'))}<input name={k} defaultValue={active[k] || ''} type={['purchasePrice', 'partsCost', 'labourCost', 'resalePrice'].includes(k) ? 'number' : 'text'} min="0" step="0.01"/></label>)}{user.role === 'admin' && <><label>Data status<select name="dataStatus" defaultValue={active.dataStatus}>{['pending', 'none', 'recovered', 'returned'].map(s => <option key={s}>{s}</option>)}</select></label></>}</div><p>Restoration cost: {money(active.partsCost + active.labourCost)} · Resale margin: {money(active.resalePrice - active.purchasePrice - active.partsCost - active.labourCost)}</p><button className="button green" disabled={busy}>Save operations record</button></form>}</>}
                    </>}
    </div></div></div>;
}

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
let server: Server, base: string, temp: string;
before(async () => { temp = await mkdtemp(join(tmpdir(), 'rebyte-test-')); process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    process.env.DATA_FILE = join(temp, 'state.json'); process.env.STORAGE_DIR = join(temp, 'private'); process.env.DEMO_MODE = 'true'; process.env.TEST_MODE = 'true'; const { app } = await import('../src/server'); server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.on('listening', r)); base = 'http://127.0.0.1:' + ((server.address() as any).port); });
after(async () => { await new Promise<void>(r => server.close(() => r())); await rm(temp, { recursive: true, force: true }); });
async function call(path: string, method = 'GET', body?: any, token?: string) { const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json() as any }; }
async function login(role: string) { return (await call('/auth/demo', 'POST', { role })).body.token; }
test('unauthenticated inventory is protected', async () => { assert.equal((await call('/devices')).status, 401); });
test('customer sees their own safe projection and cannot patch staff fields', async () => { const token = await login('customer'), list = await call('/devices', 'GET', undefined, token); assert.equal(list.status, 200); assert.equal('purchasePrice' in list.body[0], false); assert.equal((await call('/devices/RB-1042', 'PATCH', { version: 1, purchasePrice: 1 }, token)).status, 403); assert.equal((await call('/audit', 'GET', undefined, token)).status, 403); });
test('OTP wrong attempts persist; correct code locks after five failures', async () => {
    const phone = '+919876500099';
    const request = await call('/auth/otp/request', 'POST', { phone });
    for (let i = 0; i < 5; i++)
        assert.equal((await call('/auth/otp/verify', 'POST', { phone, code: 'bad' })).status, 400);
    const r = await call('/auth/otp/verify', 'POST', { phone, code: request.body.demoCode });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /locked/);
});
test('new verified owner registers device, owns it, and has no access to seed owner', async () => { const phone = '+919876500088'; const request = await call('/auth/otp/request', 'POST', { phone }); const auth = await call('/auth/otp/verify', 'POST', { phone, code: request.body.demoCode }); assert.equal(auth.body.user.role, 'customer'); const token = auth.body.token; const device = await call('/devices', 'POST', { brand: 'Dell', model: 'Inspiron', condition: 'Dead', location: 'Chennai', photos: [], recoveryConsent: true }, token); assert.equal(device.status, 200); const list = await call('/devices', 'GET', undefined, token); assert.equal(list.body.length, 1); assert.equal(list.body[0].id, device.body.id); assert.equal((await call('/devices/RB-1042/action', 'POST', { action: 'decision', value: 'decline', version: 1 }, token)).status, 403); });
test('decline closes customer journey, keeps internal status and creates no future customer updates', async () => { const token = await login('customer'); let d = (await call('/devices', 'GET', undefined, token)).body[0]; const decline = await call('/devices/' + d.id + '/action', 'POST', { action: 'decision', value: 'decline', version: d.version }, token); assert.equal(decline.body.customerClosed, true); const admin = await login('admin'); d = (await call('/devices', 'GET', undefined, admin)).body.find((v: any) => v.id === 'RB-1042'); assert.equal(d.status, 'owner_decision_required'); const blocked = await call('/devices/' + d.id + '/action', 'POST', { action: 'transition', value: 'refurbished_inventory', version: d.version }, admin); assert.equal(blocked.status, 400); });
test('stale writes rejected and sessions can be revoked', async () => { const token = await login('admin'); assert.equal((await call('/devices/RB-1042', 'PATCH', { version: -1, diagnosis: 'stale' }, token)).status, 400); assert.equal((await call('/auth/logout', 'POST', {}, token)).status, 200); assert.equal((await call('/me', 'GET', undefined, token)).status, 401); });
test('recovery files are owner-only, single-use and need owner receipt confirmation', async () => { const owner = await login('customer'), admin = await login('admin'); const upload = await call('/devices/RB-1042/recovery/upload', 'POST', { fileName: 'memories.txt', base64: Buffer.from('Recovered demo memories').toString('base64') }, admin); assert.equal(upload.status, 200); const phone = '+919876500077', request = await call('/auth/otp/request', 'POST', { phone }), stranger = (await call('/auth/otp/verify', 'POST', { phone, code: request.body.demoCode })).body.token; assert.equal((await call('/devices/RB-1042/recovery/request', 'POST', {}, stranger)).status, 403); assert.equal((await call('/devices/RB-1042/recovery/confirm', 'POST', {}, owner)).status, 400); const link = await call('/devices/RB-1042/recovery/request', 'POST', {}, owner); assert.equal(link.body.free, true); const url = base + link.body.url.replace('/api/', '/'); assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + stranger } })).status, 403); const download = await fetch(url, { headers: { Authorization: 'Bearer ' + owner } }); assert.equal(download.status, 200); assert.equal(await download.text(), 'Recovered demo memories'); assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + owner } })).status, 403); assert.equal((await call('/devices/RB-1042/recovery/confirm', 'POST', {}, owner)).status, 200); const devices = (await call('/devices', 'GET', undefined, owner)).body; assert.equal(devices.find((d: any) => d.id === 'RB-1042').dataStatus, 'returned'); });
test('complete registration → restoration → decline → free recovery return → sanitized inventory → sale', async () => {
  const admin=await login('admin'),ops=await login('operations'),tech=await login('technician');
  const phone='+919876500066',otp=await call('/auth/otp/request','POST',{phone});
  const owner=(await call('/auth/otp/verify','POST',{phone,code:otp.body.demoCode,name:'Journey test owner'})).body.token;
  const created=await call('/devices','POST',{brand:'Dell',model:'Latitude',condition:'Dead; family files on disk',location:'Chennai',photos:[],recoveryConsent:true},owner);
  assert.equal(created.status,200);const id=created.body.id;
  async function full(){return (await call('/devices','GET',undefined,admin)).body.find((d:any)=>d.id===id)}
  async function patch(token:string,fields:any){const d=await full();const r=await call('/devices/'+id,'PATCH',{version:d.version,...fields},token);assert.equal(r.status,200,JSON.stringify(r.body));}
  async function advance(token:string,status:string){const d=await full();const r=await call('/devices/'+id+'/action','POST',{version:d.version,action:'transition',value:status},token);assert.equal(r.status,200,JSON.stringify(r.body));}
  await collection(id, owner, ops, admin, 'DELL-FLOW-1', 1000);
  await advance(ops,'received'); await advance(tech,'diagnosis');
  await workflow(id, tech, admin, '/repair', {diagnosis:'Power board repaired',parts:[{name:'Power board',quantity:1,unitCost:1500}],labourCost:500});
  await verifyOwnership(id, owner, admin, 'DELL-FLOW-1');
  await advance(tech,'restoration_started');await advance(tech,'data_recovery');
  assert.equal((await call('/devices/'+id+'/recovery/upload','POST',{fileName:'owner-memories.txt',base64:Buffer.from('Verified original owner memories').toString('base64')},admin)).status,200);
  await advance(tech,'testing');await workflow(id,tech,admin,'/quality',{checks:passedChecks,notes:'All tests passed on test device'});await advance(tech,'restored');await advance(admin,'owner_decision_required');
  let d=await full();assert.equal((await call('/devices/'+id+'/action','POST',{version:d.version,action:'decision',value:'decline'},owner)).status,200);
  d=await full();assert.equal(d.customerClosed,true);assert.equal((await call('/devices/'+id+'/action','POST',{version:d.version,action:'transition',value:'refurbished_inventory'},ops)).status,400);
  const link=await call('/devices/'+id+'/recovery/request','POST',{},owner);const file=await fetch(base+link.body.url.replace('/api/','/'),{headers:{Authorization:'Bearer '+owner}});assert.equal(await file.text(),'Verified original owner memories');
  assert.equal((await call('/devices/'+id+'/recovery/confirm','POST',{},owner)).status,200);await patch(admin,{wipeCertificate:'TEST-VERIFIED-SANITIZATION-1'});
  await advance(ops,'refurbished_inventory');await patch(ops,{resaleBuyer:'Demo second owner',resalePrice:9000});await advance(ops,'sold');await advance(ops,'journey_completed');
  d=await full();assert.equal(d.status,'journey_completed');assert.equal(d.resalePrice-d.purchasePrice-d.partsCost-d.labourCost,6000);
  const customer=(await call('/devices','GET',undefined,owner)).body.find((v:any)=>v.id===id);assert.equal(customer.customerClosed,true);assert.equal(customer.dataStatus,'returned');assert.equal(customer.events.some((e:any)=>e.kind==='sold'),false);
  const notifications=(await call('/notifications','GET',undefined,owner)).body;assert.equal(notifications.some((n:any)=>n.message==='sold'),false);
});
test('owner reclaim returns the same laptop and closes the customer chapter', async()=>{
  const admin=await login('admin'),ops=await login('operations'),tech=await login('technician');
  const phone='+919876500055',otp=await call('/auth/otp/request','POST',{phone});const owner=(await call('/auth/otp/verify','POST',{phone,code:otp.body.demoCode})).body.token;
  const created=await call('/devices','POST',{brand:'HP',model:'ProBook',condition:'Old battery',location:'Chennai',photos:[],recoveryConsent:false},owner),id=created.body.id;
  async function full(){return (await call('/devices','GET',undefined,admin)).body.find((d:any)=>d.id===id)}
  async function advance(token:string,stage:string){const d=await full();const r=await call('/devices/'+id+'/action','POST',{action:'transition',value:stage,version:d.version},token);assert.equal(r.status,200,JSON.stringify(r.body))}
  let d=await full();await collection(id,owner,ops,admin,'HP-RECLAIM-1',0);
  await advance(ops,'received');await advance(tech,'diagnosis');
  await workflow(id,tech,admin,'/repair',{diagnosis:'Battery replaced',parts:[{name:'Battery',quantity:1,unitCost:500}],labourCost:250});
  await advance(tech,'restoration_started');await advance(tech,'testing');
  await workflow(id,tech,admin,'/quality',{checks:passedChecks,notes:'All tests passed'});await advance(tech,'restored');
  await verifyOwnership(id,owner,admin,'HP-RECLAIM-1');await advance(admin,'owner_decision_required');d=await full();assert.equal((await call('/devices/'+id+'/action','POST',{action:'decision',value:'reclaim',version:d.version},owner)).status,200);
  await advance(ops,'returned_to_owner');await advance(ops,'journey_completed');d=await full();assert.equal(d.id,id);assert.equal(d.ownerDecision,'reclaim');assert.equal(d.customerClosed,true);assert.equal(d.resalePrice,0);
});

const passedChecks = {boot:true,display:true,keyboard:true,network:true,battery:true,storage:true};
const proofPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S8AAAAASUVORK5CYII=';
async function fullDevice(id:string, admin:string) {return (await call('/devices','GET',undefined,admin)).body.find((d:any)=>d.id===id)}
async function workflow(id:string, token:string, admin:string, path:string, fields:any) {
  const d=await fullDevice(id,admin);const r=await call('/devices/'+id+path,'POST',{version:d.version,...fields},token);
  assert.equal(r.status,200,JSON.stringify(r.body));return r.body;
}
async function collection(id:string, owner:string, ops:string, admin:string, serial:string, price:number) {
  await workflow(id,ops,admin,'/pickup/schedule',{pickupAt:new Date(Date.now()+86400000).toISOString(),collectorId:'ops-1',location:'Adyar, Chennai'});
  await workflow(id,owner,admin,'/pickup/confirm',{});
  await workflow(id,ops,admin,'/pickup/collect',{serial,condition:'Inspected old laptop',purchasePrice:price,acquisitionSource:'Original owner',receipt:'SIGNED-TEST-HANDOVER',paymentReference:price?'TEST-BANK-TRANSFER':'ZERO-VALUE-ACKNOWLEDGEMENT'});
}
async function verifyOwnership(id:string, owner:string, admin:string, serial:string) {
  await workflow(id,owner,admin,'/ownership',{claimedSerial:serial,explanation:'I purchased this laptop; serial sticker attached.',declaration:true,photo:proofPhoto});
  assert.equal((await call('/devices/'+id+'/ownership/evidence','GET',undefined,admin)).status,200);
  await workflow(id,admin,admin,'/ownership/review',{status:'approved',note:'Reviewed proof against collected serial and original owner handover'});
}
async function newCustomer(phone:string) {const otp=await call('/auth/otp/request','POST',{phone});return (await call('/auth/otp/verify','POST',{phone,code:otp.body.demoCode})).body.token;}
async function newDevice(owner:string) {return (await call('/devices','POST',{brand:'Lenovo',model:'ThinkPad',condition:'Dead',location:'Chennai',photos:[],recoveryConsent:true},owner)).body.id;}
test('private ownership evidence needs admin review, inspected matching serial, and cannot be bypassed by PATCH',async()=>{
 const admin=await login('admin'),ops=await login('operations'),owner=await newCustomer('+919876500044'),id=await newDevice(owner);
 await collection(id,owner,ops,admin,'MATCH-44',1000);
 let d=await fullDevice(id,admin);assert.equal((await call('/devices/'+id,'PATCH',{version:d.version,identityVerified:true},admin)).status,403);
 await workflow(id,owner,admin,'/ownership',{claimedSerial:'WRONG-44',explanation:'Original purchase evidence',declaration:true,photo:proofPhoto});
 assert.equal((await call('/devices/'+id+'/ownership/evidence','GET',undefined,ops)).status,403);
 d=await fullDevice(id,admin);assert.equal((await call('/devices/'+id+'/ownership/review','POST',{version:d.version,status:'approved',note:'Review'},admin)).status,400);
 assert.equal((await call('/devices/'+id+'/ownership/evidence','GET',undefined,admin)).body.photo,proofPhoto);
 assert.equal((await call('/devices/'+id+'/ownership/review','POST',{version:d.version,status:'approved',note:'Review'},admin)).status,400);
 await workflow(id,admin,admin,'/ownership/review',{status:'rejected',note:'Serial differs from inspected device'});
 const safe=(await call('/devices','GET',undefined,owner)).body.find((v:any)=>v.id===id);assert.equal(safe.ownershipStatus,'rejected');assert.equal('ownership' in safe,false);
 await verifyOwnership(id,owner,admin,'MATCH-44');d=await fullDevice(id,admin);assert.equal(d.identityVerified,true);
 assert.equal((await call('/devices/'+id,'PATCH',{version:d.version,serial:'CHANGED'},ops)).status,400);
});
test('pickup rescheduling invalidates confirmation; stale, unconfirmed and undocumented collection is blocked',async()=>{
 const admin=await login('admin'),ops=await login('operations'),owner=await newCustomer('+919876500033'),id=await newDevice(owner);
 const schedule={pickupAt:new Date(Date.now()+86400000).toISOString(),collectorId:'ops-1',location:'Adyar, Chennai'};
 await workflow(id,ops,admin,'/pickup/schedule',schedule);let d=await fullDevice(id,admin);
 const collect={version:d.version,serial:'PICKUP-33',condition:'Dead',purchasePrice:0,acquisitionSource:'Owner',receipt:'R33',paymentReference:'ZERO-ACK'};
 assert.equal((await call('/devices/'+id+'/pickup/collect','POST',collect,ops)).status,400);
 await workflow(id,owner,admin,'/pickup/confirm',{});await workflow(id,ops,admin,'/pickup/schedule',schedule);
 d=await fullDevice(id,admin);assert.equal(d.pickup.confirmedAt,undefined);
 assert.equal((await call('/devices/'+id+'/pickup/confirm','POST',{version:-1},owner)).status,400);
 await workflow(id,owner,admin,'/pickup/confirm',{});d=await fullDevice(id,admin);
 assert.equal((await call('/devices/'+id+'/pickup/collect','POST',{...collect,version:d.version,paymentReference:''},ops)).status,400);
 assert.equal((await fullDevice(id,admin)).status,'pickup_scheduled');
});
test('QC failure blocks restoration; rework clears previous QC and repair costs come from parts',async()=>{
 const admin=await login('admin'),ops=await login('operations'),tech=await login('technician'),owner=await newCustomer('+919876500022'),id=await newDevice(owner);
 await collection(id,owner,ops,admin,'QC-22',0);
 async function advance(stage:string){const d=await fullDevice(id,admin);return call('/devices/'+id+'/action','POST',{version:d.version,action:'transition',value:stage},admin)}
 assert.equal((await advance('received')).status,200);assert.equal((await advance('diagnosis')).status,200);
 assert.equal((await advance('restoration_started')).status,400);
 await workflow(id,tech,admin,'/repair',{diagnosis:'Power circuit repair',parts:[{name:'Capacitor',quantity:2,unitCost:125.5}],labourCost:300});
 assert.equal((await fullDevice(id,admin)).partsCost,251);assert.equal((await advance('restoration_started')).status,200);assert.equal((await advance('testing')).status,200);
 assert.equal((await advance('restored')).status,400);
 await workflow(id,tech,admin,'/quality',{checks:{...passedChecks,battery:false},notes:'Battery fails capacity check'});assert.equal((await advance('restored')).status,400);
 await workflow(id,tech,admin,'/quality',{checks:passedChecks,notes:'All checks passed'});assert.equal((await advance('restoration_started')).status,200);assert.equal((await fullDevice(id,admin)).quality,undefined);
});
test('WhatsApp updates require explicit opt-in and withdrawal suppresses pending delivery',async()=>{
 const admin=await login('admin'),owner=await newCustomer('+919876500011'),id=await newDevice(owner);
 let notes=(await call('/notifications','GET',undefined,owner)).body;assert.equal(notes.some((n:any)=>n.channel==='whatsapp'),false);
 assert.equal((await call('/me/preferences','PATCH',{whatsappOptIn:true},owner)).status,200);
 let d=await fullDevice(id,admin);assert.equal((await call('/devices/'+id+'/action','POST',{version:d.version,action:'consent',value:false},owner)).status,200);
 notes=(await call('/notifications','GET',undefined,owner)).body;assert.equal(notes.some((n:any)=>n.channel==='whatsapp'),true);
 assert.equal((await call('/me/preferences','PATCH',{whatsappOptIn:false},owner)).status,200);
 notes=(await call('/notifications','GET',undefined,owner)).body;assert.equal(notes.filter((n:any)=>n.channel==='whatsapp').every((n:any)=>n.status!=='pending'),true);
 assert.equal((await call('/me/preferences','PATCH',{whatsappOptIn:true},admin)).status,403);
});

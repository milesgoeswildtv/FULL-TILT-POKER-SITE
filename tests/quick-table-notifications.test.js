import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/app.js';

class MemoryStorage{constructor(){this.map=new Map()}async get(k){return this.map.get(k)}async put(k,v){this.map.set(k,structuredClone(v))}async delete(k){this.map.delete(k)}async setAlarm(){}async deleteAlarm(){}}
function harness(){const deliveries=[],storage=new MemoryStorage(),state={storage,getWebSockets:()=>[]},env={ACCOUNTS:{idFromName:x=>String(x),get:accountId=>({fetch:async req=>{deliveries.push({accountId:String(accountId),path:new URL(req.url).pathname,body:await req.json()});return Response.json({ok:true})}})}};return{table:new PokerTable(state,env),deliveries}}
async function post(table,path,body){return table.fetch(new Request(`https://table${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))}

test('second human at a quick table sends one table-ready event to the host',async()=>{const h=harness();let r=await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});assert.equal(r.status,200);r=await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});assert.equal(r.status,200);assert.equal(h.deliveries.length,1);assert.equal(h.deliveries[0].accountId,'host-account');assert.equal(h.deliveries[0].path,'/notifications/enqueue');assert.equal(h.deliveries[0].body.event.kind,'table-ready');assert.equal(h.deliveries[0].body.event.code,'ABC123');assert.equal(h.deliveries[0].body.event.playerCount,2)});

test('later quick-table joins send player-joined instead of another table-ready event',async()=>{const h=harness();await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});await post(h.table,'/join',{name:'Guest Two',accountId:'guest-2'});assert.equal(h.deliveries.length,2);assert.equal(h.deliveries[0].body.event.kind,'table-ready');assert.equal(h.deliveries[1].body.event.kind,'player-joined');assert.equal(h.deliveries[1].body.event.playerName,'Guest Two');assert.equal(h.deliveries[1].body.event.playerCount,3)});


test('turn reminder fires once for the current quick-table turn and re-arms timeout',async()=>{const h=harness();const alarms=[];h.table.state.storage.setAlarm=async at=>{alarms.push(at)};await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});const host=h.table.data.players.find(p=>p.host);await post(h.table,'/action',{token:host.token,type:'start'});const current=h.table.data.players[h.table.data.turnIndex],serial=h.table.data.turnSerial,deadline=h.table.data.turnDeadline,reminderAt=h.table.data.turnReminderAt;assert.ok(current.accountId);assert.equal(serial>0,true);assert.ok(reminderAt<deadline);assert.ok(deadline-reminderAt>=5000);const before=h.deliveries.length;assert.equal(await h.table.sendTurnReminderIfDue(reminderAt),true);assert.equal(h.deliveries.length,before+1);const event=h.deliveries.at(-1).body.event;assert.equal(event.kind,'turn-reminder');assert.equal(event.code,'ABC123');assert.equal(event.playerId,current.id);assert.equal(await h.table.sendTurnReminderIfDue(reminderAt+1),false);assert.equal(h.table.data.turnReminderSentSerial,serial);assert.ok(alarms.includes(deadline))});

test('acting before reminder advances the turn serial and prevents stale reminder delivery',async()=>{const h=harness();await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});const host=h.table.data.players.find(p=>p.host);await post(h.table,'/action',{token:host.token,type:'start'});const oldSerial=h.table.data.turnSerial,oldReminder=h.table.data.turnReminderAt,current=h.table.data.players[h.table.data.turnIndex];await post(h.table,'/action',{token:current.token,type:h.table.toCall(current)>0?'call':'check'});assert.notEqual(h.table.data.turnSerial,oldSerial);assert.notEqual(h.table.data.turnReminderAt,oldReminder);const count=h.deliveries.filter(x=>x.body.event?.kind==='turn-reminder').length;assert.equal(count,0)});


test('pause and resume preserve the same turn serial and do not create duplicate reminders',async()=>{const h=harness();await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});const host=h.table.data.players.find(p=>p.host);await post(h.table,'/action',{token:host.token,type:'start'});const serial=h.table.data.turnSerial;await post(h.table,'/action',{token:host.token,type:'pause'});assert.equal(h.table.data.turnSerial,serial);assert.equal(h.table.data.turnReminderAt,null);assert.equal(h.table.data.turnDeadline,null);await post(h.table,'/action',{token:host.token,type:'resume'});assert.equal(h.table.data.turnSerial,serial);assert.ok(h.table.data.turnReminderAt);const before=h.deliveries.filter(x=>x.body.event?.kind==='turn-reminder').length;const at=h.table.data.turnReminderAt;assert.equal(await h.table.sendTurnReminderIfDue(at),true);assert.equal(await h.table.sendTurnReminderIfDue(at+1),false);const after=h.deliveries.filter(x=>x.body.event?.kind==='turn-reminder').length;assert.equal(after,before+1)});


test('sit out auto-folds the current human immediately, suppresses turn reminders, and allows sit back in',async()=>{
 const h=harness();
 await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});
 await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});
 const host=h.table.data.players.find(p=>p.host);
 await post(h.table,'/action',{token:host.token,type:'start'});
 const current=h.table.data.players[h.table.data.turnIndex],currentId=current.id;
 const beforeReminders=h.deliveries.filter(x=>x.body.event?.kind==='turn-reminder').length;
 let r=await post(h.table,'/action',{token:current.token,type:'sitout'});
 assert.equal(r.status,200);
 let body=await r.json();
 assert.equal(h.table.data.players.find(p=>p.id===currentId).sittingOut,true);
 assert.equal(body.players.find(p=>p.id===currentId).sittingOut,true);
 assert.ok(h.table.data.actionLog.some(x=>x.type==='sitout'&&/auto-folded/.test(x.text))||h.table.data.handHistory[0]?.actionLog?.some(x=>x.type==='sitout'&&/auto-folded/.test(x.text)));
 assert.equal(h.deliveries.filter(x=>x.body.event?.kind==='turn-reminder').length,beforeReminders);
 r=await post(h.table,'/action',{token:current.token,type:'sitin'});
 assert.equal(r.status,200);
 body=await r.json();
 assert.equal(h.table.data.players.find(p=>p.id===currentId).sittingOut,false);
 assert.equal(body.players.find(p=>p.id===currentId).sittingOut,false);
});


test('time bank starts at 60s, spends 15s per use, extends only the current deadline, and never refills',async()=>{
 const h=harness(),alarms=[];
 h.table.state.storage.setAlarm=async at=>{alarms.push(at)};
 await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});
 await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});
 const host=h.table.data.players.find(p=>p.host);
 await post(h.table,'/action',{token:host.token,type:'start'});
 const current=h.table.data.players[h.table.data.turnIndex],other=h.table.data.players.find(p=>p.id!==current.id),serial=h.table.data.turnSerial,startDeadline=h.table.data.turnDeadline;
 assert.equal(current.timeBankMs,60000);
 assert.equal(other.timeBankMs,60000);
 let response=await post(h.table,'/action',{token:current.token,type:'timebank'});
 assert.equal(response.status,200);
 let body=await response.json(),me=body.players.find(p=>p.id===current.id);
 assert.equal(me.timeBankMs,45000);
 assert.equal(body.timeBankChunkMs,15000);
 assert.equal(h.table.data.turnDeadline,startDeadline+15000);
 assert.equal(h.table.data.turnSerial,serial);
 for(let i=0;i<3;i++){response=await post(h.table,'/action',{token:current.token,type:'timebank'});assert.equal(response.status,200)}
 assert.equal(h.table.data.players.find(p=>p.id===current.id).timeBankMs,0);
 assert.equal(h.table.data.turnDeadline,startDeadline+60000);
 assert.equal(h.table.data.turnSerial,serial);
 response=await post(h.table,'/action',{token:current.token,type:'timebank'});
 assert.equal(response.status,400);
 assert.match((await response.json()).error,/empty/i);
 assert.ok(h.table.data.actionLog.filter(x=>x.type==='timebank'&&x.playerId===current.id).length===4);
 assert.ok(alarms.length>=4);
});

test('time bank rejects non-turn, sitting-out, paused, and expired use',async()=>{
 const h=harness();
 await post(h.table,'/init',{code:'ABC123',hostName:'Host',accountId:'host-account',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]});
 await post(h.table,'/join',{name:'Guest One',accountId:'guest-1'});
 const host=h.table.data.players.find(p=>p.host);
 await post(h.table,'/action',{token:host.token,type:'start'});
 const current=h.table.data.players[h.table.data.turnIndex],other=h.table.data.players.find(p=>p.id!==current.id);
 let response=await post(h.table,'/action',{token:other.token,type:'timebank'});
 assert.equal(response.status,400);
 assert.match((await response.json()).error,/only available on your turn/i);
 current.sittingOut=true;
 assert.throws(()=>h.table.useTimeBank(current,Date.now()),/Sit back in/i);
 current.sittingOut=false;
 h.table.data.paused=true;
 assert.throws(()=>h.table.useTimeBank(current,Date.now()),/not available/i);
 h.table.data.paused=false;
 const deadline=h.table.data.turnDeadline;
 assert.throws(()=>h.table.useTimeBank(current,deadline),/already expired/i);
});

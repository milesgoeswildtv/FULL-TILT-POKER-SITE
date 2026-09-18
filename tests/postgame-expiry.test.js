import test from'node:test';
import assert from'node:assert/strict';
import{POSTGAME_WINDOW_MS,armPostgame,postgameExpired,postgameRemainingMs}from'../worker/postgame.js';
import{PokerTable}from'../worker/app.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{PlayerAccount}from'../worker/player-account.js';
import{accountRequest}from'../worker/account-links.js';
import{handleAccessApi}from'../worker/access.js';
import{AccessRegistry}from'../worker/access-registry.js';

class MemoryStorage{
 constructor(){this.map=new Map();this.alarm=null}
 async get(k){return this.map.get(k)}
 async put(k,v){this.map.set(k,v)}
 async delete(k){this.map.delete(k)}
 setAlarm(v){this.alarm=v;return Promise.resolve()}
 deleteAlarm(){this.alarm=null;return Promise.resolve()}
 async getAlarm(){return this.alarm}
}
function memoryState(sockets=[]){return{storage:new MemoryStorage(),getWebSockets(){return sockets},acceptWebSocket(){}}}
function post(url,body,headers={}){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)})}

class AccountNamespace{
 constructor(){this.rows=new Map()}
 idFromName(name){return String(name)}
 get(id){id=String(id);if(!this.rows.has(id)){const st=memoryState(),env={ACCOUNTS:this};this.rows.set(id,{account:new PlayerAccount(st,env)})}const row=this.rows.get(id);return{fetch:(input,init)=>row.account.fetch(input instanceof Request?input:new Request(input,init))}}
}
class TableNamespace{
 constructor(){this.controls=[]}
 idFromName(name){return String(name)}
 get(id){return{fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/mtt/control'){const b=await req.json();this.controls.push({id:String(id),type:b.type});return Response.json({ok:true,status:'finished'})}return Response.json({error:'not found'},{status:404})}}}
}
class AccessNamespace{
 constructor(){this.registry=new AccessRegistry(memoryState(),{})}
 idFromName(name){return String(name)}
 get(){return{fetch:(input,init)=>this.registry.fetch(input instanceof Request?input:new Request(input,init))}}
}
class TerminalGameNamespace{
 idFromName(name){return String(name)}
 get(){return{fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/access-exists')return Response.json({error:'complete'},{status:410});return Response.json({error:'not found'},{status:404})}}}
}

test('postgame window is exactly ten minutes',()=>{
 const d={finishedAt:1_000};const ends=armPostgame(d,1_000);
 assert.equal(ends,1_000+POSTGAME_WINDOW_MS);
 assert.equal(POSTGAME_WINDOW_MS,600_000);
 assert.equal(postgameRemainingMs(d,1_000),600_000);
 assert.equal(postgameExpired(d,ends-1),false);
 assert.equal(postgameExpired(d,ends),true);
});

test('finished table stays available during buffer then expires sessions, sockets, and invite access',async()=>{
 const accounts=new AccountNamespace(),env={ACCOUNTS:accounts},socket={messages:[],closed:null,send(v){this.messages.push(v)},close(code,reason){this.closed={code,reason}}},st=memoryState([socket]),table=new PokerTable(st,env);
 const host={id:'host',provider:'discord',providerId:'host',username:'host',displayName:'Host'},guest={id:'guest',provider:'discord',providerId:'guest',username:'guest',displayName:'Guest'};
 await accountRequest(env,host,'/sync');await accountRequest(env,guest,'/sync');
 await accountRequest(env,host,'/access/invite-grant',{kind:'table',code:'BUF123',source:'created'});
 await accountRequest(env,guest,'/access/invite-grant',{kind:'table',code:'BUF123',source:'invite'});
 let r=await table.fetch(post('https://table/init',{code:'BUF123',hostName:'Host',accountId:'host',startingChips:2500,blindMinutes:10,blindStructure:[[10,20]]})),created=await r.json();
 assert.ok(created.token);
 r=await table.fetch(post('https://table/join',{name:'Guest',accountId:'guest'}));const joined=await r.json();assert.ok(joined.token);
 table.data.started=false;table.data.street='finished';table.data.finishedAt=Date.now();table.data.players[0].finishPlace=1;table.data.players[1].finishPlace=2;table.armPostgame(table.data.finishedAt);await table.save();
 r=await table.fetch(new Request('https://table/state?token='+created.token));assert.equal(r.status,200);let body=await r.json();assert.ok(body.postgameEndsAt>body.finishedAt);
 r=await table.fetch(post('https://table/join',{name:'Late',accountId:'late'}));assert.equal(r.status,409);
 table.data.postgameEndsAt=Date.now()-1;await table.save();
 r=await table.fetch(new Request('https://table/state?token='+created.token));assert.equal(r.status,410);body=await r.json();assert.equal(body.postgameExpired,true);
 assert.equal(socket.closed.code,4002);
 let profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.invites.some(x=>x.code==='BUF123'),false);
 profile=await accountRequest(env,guest,'/profile');assert.equal(profile.account.access.invites.some(x=>x.code==='BUF123'),false);
});

test('tournament expires after buffer, revokes access, and tells every provisioned child table to close sessions',async()=>{
 const accounts=new AccountNamespace(),tables=new TableNamespace(),env={ACCOUNTS:accounts,TABLES:tables},st=memoryState(),coordinator=new TournamentCoordinator(st,env);
 const host={id:'mhost',provider:'discord',providerId:'mhost',username:'mhost',displayName:'MHost'},guest={id:'mguest',provider:'discord',providerId:'mguest',username:'mguest',displayName:'MGuest'};
 await accountRequest(env,host,'/sync');await accountRequest(env,guest,'/sync');
 await accountRequest(env,host,'/access/invite-grant',{kind:'tournament',code:'MTTBUF',source:'created'});
 await accountRequest(env,guest,'/access/invite-grant',{kind:'tournament',code:'MTTBUF',source:'invite'});
 let r=await coordinator.fetch(post('https://tournament/init',{code:'MTTBUF',players:[{name:'MHost',accountId:'mhost'},{name:'MGuest',accountId:'mguest'}],startingChips:2500,blindStructure:[[10,20]],levelDurationMs:60000}));assert.equal(r.status,201);const init=await r.json();
 coordinator.data.tables.forEach((t,i)=>{t.provisioned=true;t.tableKey='MTTBUF-T'+(i+1);t.status='closed'});
 coordinator.data.status='finished';coordinator.data.finishedAt=Date.now();coordinator.data.players[0].finishPlace=1;coordinator.data.players[0].chips=5000;coordinator.data.players[1].finishPlace=2;coordinator.data.players[1].chips=0;coordinator.data.players[1].eliminated=true;coordinator.armPostgame(coordinator.data.finishedAt);await coordinator.save();
 r=await coordinator.fetch(new Request('https://tournament/session?token='+encodeURIComponent(init.token)));assert.equal(r.status,200);
 coordinator.data.postgameEndsAt=Date.now()-1;await coordinator.save();
 r=await coordinator.fetch(new Request('https://tournament/session?token='+encodeURIComponent(init.token)));assert.equal(r.status,410);
 assert.ok(tables.controls.length>0);
 assert.ok(tables.controls.every(x=>x.type==='expire-postgame'));
 let profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.invites.some(x=>x.code==='MTTBUF'),false);
 profile=await accountRequest(env,guest,'/profile');assert.equal(profile.account.access.invites.some(x=>x.code==='MTTBUF'),false);
});

test('completed games reject new invite validation immediately, before the ten minute viewer buffer ends',async()=>{
 const env={TABLES:new TerminalGameNamespace(),TOURNAMENTS:new TerminalGameNamespace(),ACCESS_REGISTRY:new AccessNamespace(),ACCESS_ADMIN_SECRET:'x'};
 const r=await handleAccessApi(post('https://crashout.test/api/access/invite/validate',{kind:'table',code:'END123'}),env);
 assert.equal(r.status,404);
});

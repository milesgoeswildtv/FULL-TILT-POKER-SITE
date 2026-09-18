import test from'node:test';
import assert from'node:assert/strict';
import{GameRegistry}from'../worker/game-registry.js';
import{PokerTable}from'../worker/app.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{PlayerAccount}from'../worker/player-account.js';
import{accountRequest}from'../worker/account-links.js';
import{gatePokerRequest}from'../worker/auth.js';
import{handleAccessApi}from'../worker/access.js';

const enc=new TextEncoder();
class MemoryStorage{
 constructor(){this.map=new Map()}
 async get(k){return this.map.get(k)}
 async put(k,v){this.map.set(k,v)}
 async delete(k){this.map.delete(k)}
 async list({prefix=''}={}){return new Map([...this.map.entries()].filter(([k])=>String(k).startsWith(prefix)))}
 setAlarm(){return Promise.resolve()}
 deleteAlarm(){return Promise.resolve()}
}
function state(){return{storage:new MemoryStorage(),getWebSockets(){return[]},acceptWebSocket(){}}}
function post(url,body,headers={}){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)})}

class AccountNamespace{
 constructor(){this.rows=new Map()}
 idFromName(name){return String(name)}
 get(id){id=String(id);if(!this.rows.has(id)){const st=state(),env={ACCOUNTS:this};this.rows.set(id,{account:new PlayerAccount(st,env)})}const row=this.rows.get(id);return{fetch:(input,init)=>row.account.fetch(input instanceof Request?input:new Request(input,init))}}
}
class RegistryNamespace{
 constructor(){this.registry=new GameRegistry(state(),{})}
 idFromName(name){return String(name)}
 get(){return{fetch:(input,init)=>this.registry.fetch(input instanceof Request?input:new Request(input,init))}}
}
class FakeTableNamespace{
 constructor(){this.rows=new Map()}
 idFromName(name){return String(name)}
 get(id){id=String(id);if(!this.rows.has(id))this.rows.set(id,{status:'running'});const row=this.rows.get(id);return{fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/admin-summary')return Response.json({kind:'table',code:id,status:row.status,hostName:'Host',hostAccountId:'acct-host',createdAt:1000,startedAt:2000,playerCount:2,players:[{id:'p1',name:'Host',chips:3000,host:true},{id:'p2',name:'Guest',chips:2000}],winner:null,handNumber:3,street:'flop',smallBlind:25,bigBlind:50,pot:400});if(u.pathname==='/admin-control'){const b=await req.json();row.status=b.action==='end'?'ended':b.action==='resume'?'running':'paused';return Response.json({ok:true,status:row.status})}return Response.json({error:'not found'},{status:404})}}}
}
async function signedSession(identity,secret){let s='';for(const b of enc.encode(JSON.stringify(identity)))s+=String.fromCharCode(b);const body=btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body)));let raw='';for(const b of bytes)raw+=String.fromCharCode(b);const sig=btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return body+'.'+sig}
async function cookie(identity,secret){return'ftp_account='+await signedSession({...identity,exp:Date.now()+60000},secret)}

test('game registry keeps live metadata, final snapshots, and owner action history',async()=>{
 const registry=new GameRegistry(state(),{});
 let r=await registry.fetch(post('https://games.internal/record',{kind:'table',code:'ABC123',hostAccountId:'acct-1',hostName:'Host',createdAt:100,status:'lobby'}));assert.equal(r.status,201);
 r=await registry.fetch(post('https://games.internal/snapshot',{kind:'table',code:'ABC123',summary:{kind:'table',code:'ABC123',status:'running',startedAt:200,playerCount:2,players:[{name:'Host'},{name:'Guest'}]}}));assert.equal(r.status,200);
 r=await registry.fetch(post('https://games.internal/event',{kind:'table',code:'ABC123',action:'pause',result:'success'}));assert.equal(r.status,201);
 await registry.fetch(post('https://games.internal/snapshot',{kind:'table',code:'ABC123',summary:{kind:'table',code:'ABC123',status:'finished',startedAt:200,finishedAt:500,playerCount:2,players:[{name:'Host',finishPlace:1},{name:'Guest',finishPlace:2}],winner:{name:'Host'}}}));
 const list=await (await registry.fetch(new Request('https://games.internal/list'))).json();assert.equal(list.games.length,1);const game=list.games[0];assert.equal(game.status,'finished');assert.equal(game.winnerName,'Host');assert.equal(game.finalSnapshot.winner.name,'Host');assert.equal(game.adminEvents.length,1);assert.deepEqual(game.playerNames,['Host','Guest']);
});

test('table seat can be recovered by its bound account without exposing another token',async()=>{
 const env={},table=new PokerTable(state(),env);
 const init=await table.fetch(post('https://table/init',{code:'TAB123',hostName:'Host',accountId:'acct-host',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]})),created=await init.json();assert.equal(init.status,200);assert.ok(created.token);
 const recover=await table.fetch(post('https://table/recover',{accountId:'acct-host'})),body=await recover.json();assert.equal(recover.status,200);assert.equal(body.token,created.token);assert.equal(body.host,true);
 const denied=await table.fetch(post('https://table/recover',{accountId:'acct-other'}));assert.equal(denied.status,404);
 const summary=await (await table.fetch(new Request('https://table/admin-summary'))).json();assert.equal(summary.hostAccountId,'acct-host');assert.equal(summary.status,'lobby');assert.equal(summary.players[0].accountId,'acct-host');assert.equal('token'in summary.players[0],false);
});

test('tournament session can be recovered by account after local storage is lost',async()=>{
 const coordinator=new TournamentCoordinator(state(),{});
 const init=await coordinator.fetch(post('https://tournament/init',{code:'MTT123',players:[{name:'Host',accountId:'acct-host'},{name:'Guest',accountId:'acct-guest'}],startingChips:2500,blindStructure:[[10,20]],levelDurationMs:60000}));assert.equal(init.status,201);
 const recover=await coordinator.fetch(post('https://tournament/recover',{accountId:'acct-host'})),body=await recover.json();assert.equal(recover.status,200);assert.equal(body.host,true);assert.ok(body.token);assert.equal(body.session.session.name,'Host');
 const summary=await (await coordinator.fetch(new Request('https://tournament/admin-summary'))).json();assert.equal(summary.hostAccountId,'acct-host');assert.equal(summary.playerCount,2);assert.equal(summary.players.some(p=>'token'in p),false);
});

test('poker gate replaces spoofed recovery account id with the authenticated canonical account',async()=>{
 const accounts=new AccountNamespace(),secret='recover-secret',identity={id:'acct-host',provider:'discord',providerId:'acct-host',username:'host',displayName:'Host'},env={ACCOUNTS:accounts,AUTH_SECRET:secret};
 await accountRequest(env,identity,'/sync');await accountRequest(env,identity,'/access/invite-grant',{kind:'table',code:'TAB123',source:'created'});
 const c=await cookie(identity,secret),gated=await gatePokerRequest(post('https://crashout.test/api/tables/TAB123/recover',{accountId:'spoof'},{cookie:c}),env);assert.equal(gated.response,null);const body=await gated.request.json();assert.equal(body.accountId,'acct-host');
});

test('owner games API lists live games, controls them, and records admin actions',async()=>{
 const registry=new RegistryNamespace(),tables=new FakeTableNamespace(),admin='owner-secret',env={GAME_REGISTRY:registry,TABLES:tables,ACCESS_ADMIN_SECRET:admin};
 await registry.registry.fetch(post('https://games.internal/record',{kind:'table',code:'LIVE01',hostAccountId:'acct-host',hostName:'Host',status:'lobby'}));
 let r=await handleAccessApi(new Request('https://crashout.test/api/access/admin/games',{headers:{authorization:'Bearer '+admin}}),env),body=await r.json();assert.equal(r.status,200);assert.equal(body.games[0].status,'running');
 r=await handleAccessApi(post('https://crashout.test/api/access/admin/games/table/LIVE01/control',{action:'pause'},{authorization:'Bearer '+admin}),env);body=await r.json();assert.equal(r.status,200);assert.equal(body.game.status,'paused');
 const listed=await (await registry.registry.fetch(new Request('https://games.internal/list'))).json(),game=listed.games[0];assert.equal(game.status,'paused');assert.equal(game.adminEvents.length,1);assert.equal(game.adminEvents[0].action,'pause');assert.equal(game.adminEvents[0].result,'success');
});

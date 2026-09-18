import test from'node:test';
import assert from'node:assert/strict';
import{AccessRegistry}from'../worker/access-registry.js';
import{PlayerAccount}from'../worker/player-account.js';
import{accountRequest}from'../worker/account-links.js';
import{gatePokerRequest}from'../worker/auth.js';
import{finalizeHostedGame,handleAccessApi}from'../worker/access.js';

const enc=new TextEncoder();
class MemoryStorage{constructor(){this.map=new Map()}async get(k){return this.map.get(k)}async put(k,v){this.map.set(k,v)}async delete(k){this.map.delete(k)}}
function state(){return{storage:new MemoryStorage()}}
class AccountNamespace{
 constructor(){this.rows=new Map()}
 idFromName(name){return String(name)}
 get(id){id=String(id);if(!this.rows.has(id)){const st=state(),env={ACCOUNTS:this};this.rows.set(id,{st,account:new PlayerAccount(st,env)})}const row=this.rows.get(id);return{fetch:(input,init)=>row.account.fetch(input instanceof Request?input:new Request(input,init))}}
}
class AccessNamespace{constructor(){this.registry=new AccessRegistry(state(),{})}idFromName(name){return String(name)}get(){return{fetch:(input,init)=>this.registry.fetch(input instanceof Request?input:new Request(input,init))}}}
class GameNamespace{constructor(validCode){this.validCode=validCode}idFromName(name){return String(name)}get(id){return{fetch:async()=>String(id)===this.validCode?Response.json({ok:true}):Response.json({error:'not found'},{status:404})}}}
async function signedSession(identity,secret){let s='';for(const b of enc.encode(JSON.stringify(identity)))s+=String.fromCharCode(b);const body=btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body)));let raw='';for(const b of bytes)raw+=String.fromCharCode(b);const sig=btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return body+'.'+sig}
async function cookie(identity,secret){return'ftp_account='+await signedSession({...identity,exp:Date.now()+60000},secret)}
function post(url,body){return new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}
const host={id:'host-account',provider:'discord',providerId:'host-account',username:'host',displayName:'Host'};
const guest={id:'guest-account',provider:'discord',providerId:'guest-account',username:'guest',displayName:'Guest'};

test('host keys bind to the first account and cannot be shared to another account',async()=>{
 const registry=new AccessRegistry(state(),{}),generated=await registry.fetch(post('https://access.internal/admin/generate',{type:'permanent',count:1})),g=await generated.json(),key=g.keys[0].key;
 let prepared=await registry.fetch(post('https://access.internal/prepare',{key,fingerprint:'fp-a'})),p=await prepared.json();assert.equal(prepared.status,200);
 let redeemed=await registry.fetch(post('https://access.internal/redeem',{ticket:p.ticket,accountId:'account-a'})),r=await redeemed.json();assert.equal(redeemed.status,200);assert.equal(r.type,'permanent');assert.equal(r.alreadyBound,false);
 prepared=await registry.fetch(post('https://access.internal/prepare',{key,fingerprint:'fp-a'}));p=await prepared.json();redeemed=await registry.fetch(post('https://access.internal/redeem',{ticket:p.ticket,accountId:'account-a'}));r=await redeemed.json();assert.equal(redeemed.status,200);assert.equal(r.alreadyBound,true);
 prepared=await registry.fetch(post('https://access.internal/prepare',{key,fingerprint:'fp-b'}));p=await prepared.json();redeemed=await registry.fetch(post('https://access.internal/redeem',{ticket:p.ticket,accountId:'account-b'}));r=await redeemed.json();assert.equal(redeemed.status,409);assert.match(r.error,/linked to another/i);
});

test('one-time host key creates exactly one game credit and grant is idempotent',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};await accountRequest(env,host,'/sync');
 await accountRequest(env,host,'/access/host-grant',{keyId:'key-one',type:'one-time'});
 await accountRequest(env,host,'/access/host-grant',{keyId:'key-one',type:'one-time'});
 let profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,1);assert.equal(profile.account.access.canHost,true);
 const reserved=await accountRequest(env,host,'/access/host-reserve');assert.ok(reserved.reservationId);profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,0);assert.equal(profile.account.access.canHost,false);
 await accountRequest(env,host,'/access/host-release',{reservationId:reserved.reservationId});profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,1);
 const used=await accountRequest(env,host,'/access/host-reserve');await accountRequest(env,host,'/access/host-finalize',{reservationId:used.reservationId});profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,0);await assert.rejects(()=>accountRequest(env,host,'/access/host-reserve'),/Host access required/i);
});

test('permanent host access never consumes a creation credit',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};await accountRequest(env,host,'/sync');await accountRequest(env,host,'/access/host-grant',{keyId:'key-perm',type:'permanent'});
 for(let i=0;i<4;i++){const reserved=await accountRequest(env,host,'/access/host-reserve');assert.equal(reserved.permanent,true);assert.equal(reserved.reservationId,null)}
 const profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.permanentHost,true);assert.equal(profile.account.access.canHost,true);assert.equal(profile.account.access.hostCredits,0);
});

test('invite grants are account-bound and do not grant hosting',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};await accountRequest(env,guest,'/sync');await accountRequest(env,guest,'/access/invite-grant',{kind:'table',code:'ABC123',source:'code'});
 const allowed=await accountRequest(env,guest,'/access/invite-check',{kind:'table',code:'ABC123'}),denied=await accountRequest(env,guest,'/access/invite-check',{kind:'table',code:'ZZZ999'}),profile=await accountRequest(env,guest,'/profile');
 assert.equal(allowed.allowed,true);assert.equal(denied.allowed,false);assert.equal(profile.account.access.canHost,false);assert.equal(profile.account.access.latestInvite.code,'ABC123');
});

test('backend gate blocks creation without host access and blocks private games without an invite',async()=>{
 const ns=new AccountNamespace(),secret='access-gate-secret',env={ACCOUNTS:ns,AUTH_SECRET:secret};await accountRequest(env,guest,'/sync');const c=await cookie(guest,secret);
 let gated=await gatePokerRequest(new Request('https://crashout.test/api/tables',{method:'POST',headers:{cookie:c,'content-type':'application/json'},body:JSON.stringify({startingChips:2500,blindMinutes:10})}),env);assert.equal(gated.response.status,403);
 gated=await gatePokerRequest(new Request('https://crashout.test/api/tables/ABC123',{headers:{cookie:c}}),env);assert.equal(gated.response.status,403);
 await accountRequest(env,guest,'/access/invite-grant',{kind:'table',code:'ABC123',source:'code'});
 gated=await gatePokerRequest(new Request('https://crashout.test/api/tables/ABC123',{headers:{cookie:c}}),env);assert.equal(gated.response,null);
});

test('successful one-time host creation consumes the credit and grants access to the created game',async()=>{
 const ns=new AccountNamespace(),secret='host-finalize-secret',env={ACCOUNTS:ns,AUTH_SECRET:secret};await accountRequest(env,host,'/sync');await accountRequest(env,host,'/access/host-grant',{keyId:'create-key',type:'one-time'});const c=await cookie(host,secret);
 const request=new Request('https://crashout.test/api/tables',{method:'POST',headers:{cookie:c,'content-type':'application/json'},body:JSON.stringify({startingChips:2500,blindMinutes:10})}),gated=await gatePokerRequest(request,env);assert.equal(gated.response,null);assert.ok(gated.hostReservationId);
 const response=new Response(JSON.stringify({code:'NEW123',token:'seat-token'}),{status:200,headers:{'content-type':'application/json'}});await finalizeHostedGame(env,gated,response);
 const profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,0);assert.equal(profile.account.access.canHost,false);assert.equal(profile.account.access.latestInvite.code,'NEW123');
 const check=await accountRequest(env,host,'/access/invite-check',{kind:'table',code:'NEW123'});assert.equal(check.allowed,true);
});


test('simultaneous redemption cannot bind one host key to two accounts',async()=>{
 const registry=new AccessRegistry(state(),{}),generated=await registry.fetch(post('https://access.internal/admin/generate',{type:'one-time',count:1})),g=await generated.json(),key=g.keys[0].key;
 const a=await (await registry.fetch(post('https://access.internal/prepare',{key,fingerprint:'race-a'}))).json(),b=await (await registry.fetch(post('https://access.internal/prepare',{key,fingerprint:'race-b'}))).json();
 const results=await Promise.all([registry.fetch(post('https://access.internal/redeem',{ticket:a.ticket,accountId:'race-account-a'})),registry.fetch(post('https://access.internal/redeem',{ticket:b.ticket,accountId:'race-account-b'}))]);
 assert.deepEqual(results.map(r=>r.status).sort((x,y)=>x-y),[200,409]);
});

test('simultaneous create reservations cannot spend one host credit twice',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};await accountRequest(env,host,'/sync');await accountRequest(env,host,'/access/host-grant',{keyId:'single-race-credit',type:'one-time'});
 const results=await Promise.allSettled([accountRequest(env,host,'/access/host-reserve'),accountRequest(env,host,'/access/host-reserve')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);const profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,0);
});


test('public access API issues a key ticket and links the redeemed key to the logged-in account',async()=>{
 const accounts=new AccountNamespace(),access=new AccessNamespace(),secret='public-access-secret',admin='admin-secret',env={ACCOUNTS:accounts,ACCESS_REGISTRY:access,AUTH_SECRET:secret,ACCESS_ADMIN_SECRET:admin};await accountRequest(env,host,'/sync');
 let response=await handleAccessApi(new Request('https://crashout.test/api/access/admin/keys',{method:'POST',headers:{authorization:'Bearer '+admin,'content-type':'application/json'},body:JSON.stringify({type:'one-time',count:1})}),env),body=await response.json();assert.equal(response.status,201);const rawKey=body.keys[0].key;
 response=await handleAccessApi(post('https://crashout.test/api/access/key/prepare',{key:rawKey}),env);body=await response.json();assert.equal(response.status,200);assert.equal(body.requiresLogin,true);const ticketCookie=(response.headers.get('set-cookie')||'').split(';')[0];assert.match(ticketCookie,/^ftp_host_key_ticket=/);
 const accountCookie=await cookie(host,secret);response=await handleAccessApi(new Request('https://crashout.test/api/access/key/redeem',{method:'POST',headers:{cookie:accountCookie+'; '+ticketCookie}}),env);body=await response.json();assert.equal(response.status,200);assert.equal(body.redeemed,true);assert.equal(body.type,'one-time');
 const profile=await accountRequest(env,host,'/profile');assert.equal(profile.account.access.hostCredits,1);assert.equal(profile.account.access.canHost,true);
});

test('public invite API validates a real game and links only that game to the account',async()=>{
 const accounts=new AccountNamespace(),access=new AccessNamespace(),secret='invite-api-secret',env={ACCOUNTS:accounts,ACCESS_REGISTRY:access,AUTH_SECRET:secret,TABLES:new GameNamespace('TAB123'),TOURNAMENTS:new GameNamespace('NONE00')};await accountRequest(env,guest,'/sync');
 let response=await handleAccessApi(post('https://crashout.test/api/access/invite/validate',{code:'TAB123'}),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.kind,'table');assert.equal(body.code,'TAB123');
 const c=await cookie(guest,secret);response=await handleAccessApi(new Request('https://crashout.test/api/access/invite/claim',{method:'POST',headers:{cookie:c,'content-type':'application/json'},body:JSON.stringify({code:'TAB123',kind:'table'})}),env);body=await response.json();assert.equal(response.status,200);assert.equal(body.access.latestInvite.code,'TAB123');
 const profile=await accountRequest(env,guest,'/profile');assert.equal(profile.account.access.canHost,false);assert.equal(profile.account.access.latestInvite.code,'TAB123');
});

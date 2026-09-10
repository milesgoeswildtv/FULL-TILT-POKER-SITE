import test from'node:test';
import assert from'node:assert/strict';
import{handleTournamentApi}from'../worker/mtt-public.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';

function environment(){
 const objects=new Map();
 const TOURNAMENTS={idFromName:name=>name,get:name=>{if(!objects.has(name)){let saved=null;const state={storage:{get:async()=>saved,put:async(_key,value)=>{saved=structuredClone(value)}}},coordinator=new TournamentCoordinator(state,{});objects.set(name,{fetch:req=>coordinator.fetch(req),coordinator})}return objects.get(name)}};
 return{TOURNAMENTS,objects,TABLES:{idFromName:name=>name,get:()=>{throw Error('Child table should not be reached while tournament is in lobby.')}}};
}
async function asJson(response){return{status:response.status,body:await response.json()}}
function runningProxyEnvironment(){
 let childRequest=null;
 const tournament={fetch:async req=>{
  const u=new URL(req.url);
  if(u.pathname==='/session'&&u.searchParams.get('token')==='real-token')return new Response(JSON.stringify({session:{playerId:'p01',host:false,provisioned:true,tableKey:'ABC123-T1',tableNumber:1,seat:1},tournament:{code:'ABC123',status:'running'}}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({error:'Invalid tournament session.'}),{status:403,headers:{'content-type':'application/json'}});
 }};
 const table={fetch:async req=>{childRequest=req;return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}})}};
 return{env:{TOURNAMENTS:{idFromName:x=>x,get:()=>tournament},TABLES:{idFromName:x=>x,get:()=>table}},request:()=>childRequest};
}

test('public tournament API creates a one-host lobby with a private session token',async()=>{const env=environment(),r=await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostName:'Sam',startingChips:2500,blindMinutes:10,blindStructure:[[10,20],[20,40]]})}),env),j=await r.json();assert.equal(r.status,201);assert.match(j.code,/^[A-Z0-9]{6}$/);assert.ok(j.token);assert.equal(j.host,true);assert.equal(j.players.length,1);assert.equal(j.players[0].name,'Sam');assert.equal('token'in j.players[0],false)});

test('public join returns a stable tournament token and session resolves its current seat',async()=>{const env=environment(),created=await asJson(await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostName:'Host',blindStructure:[[10,20],[20,40]]})}),env)),code=created.body.code,joined=await asJson(await handleTournamentApi(new Request(`https://fulltilt.test/api/tournaments/${code}/join`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Guest'})}),env));assert.equal(joined.status,201);const session=await asJson(await handleTournamentApi(new Request(`https://fulltilt.test/api/tournaments/${code}/session?token=${joined.body.token}`),env));assert.equal(session.status,200);assert.equal(session.body.session.name,'Guest');assert.equal(session.body.session.host,false);assert.equal(session.body.session.tableNumber,1);assert.equal(session.body.session.seat,2)});

test('non-host cannot start the public tournament',async()=>{const env=environment(),created=await asJson(await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostName:'Host',blindStructure:[[10,20],[20,40]]})}),env)),code=created.body.code,joined=await asJson(await handleTournamentApi(new Request(`https://fulltilt.test/api/tournaments/${code}/join`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Guest'})}),env)),start=await asJson(await handleTournamentApi(new Request(`https://fulltilt.test/api/tournaments/${code}/start`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:joined.body.token})}),env));assert.equal(start.status,403);assert.match(start.body.error,/host only/i)});

test('table proxy refuses to strand a player before child tables are provisioned',async()=>{const env=environment(),created=await asJson(await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostName:'Host',blindStructure:[[10,20],[20,40]]})}),env)),r=await handleTournamentApi(new Request(`https://fulltilt.test/api/tournaments/${created.body.code}/table?token=${created.body.token}`),env),j=await r.json();assert.equal(r.status,409);assert.match(j.error,/still in the lobby/i)});

test('authenticated table proxy overwrites a forged action token before reaching the child table',async()=>{const x=runningProxyEnvironment(),r=await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments/ABC123/table/action?token=real-token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'forged-token',type:'fold'})}),x.env);assert.equal(r.status,200);const forwarded=x.request(),body=await forwarded.json();assert.equal(new URL(forwarded.url).pathname,'/action');assert.equal(body.token,'real-token');assert.equal(body.type,'fold')});

test('authenticated GET proxy canonicalizes duplicate token parameters',async()=>{const x=runningProxyEnvironment(),r=await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments/ABC123/table?token=real-token&token=forged-token&view=compact'),x.env);assert.equal(r.status,200);const forwarded=x.request(),u=new URL(forwarded.url);assert.equal(u.pathname,'/state');assert.deepEqual(u.searchParams.getAll('token'),['real-token']);assert.equal(u.searchParams.get('view'),'compact')});

test('table proxy rejects invalid endpoint methods before reaching a child table',async()=>{const x=runningProxyEnvironment(),r=await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments/ABC123/table/action?token=real-token'),x.env);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST');assert.equal(x.request(),null)});

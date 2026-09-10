import test from'node:test';
import assert from'node:assert/strict';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
function response(data={ok:true},status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})}
function harness(){
 let saved=null,provisionCalls=0,controls=[];
 const provisionGate=deferred(),provisionSeen=deferred(),pauseGate=deferred(),pauseSeen=deferred();
 let blockProvision=false,blockPause=false;
 const table={fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/mtt/provision'){provisionCalls++;if(blockProvision){provisionSeen.resolve();await provisionGate.promise}return response()};if(u.pathname==='/mtt/control'){const b=await req.json();controls.push(b.type);if(b.type==='pause'&&blockPause){pauseSeen.resolve();await pauseGate.promise}return response()}return response({error:'unexpected child route'},404)}};
 const state={storage:{get:async()=>saved?structuredClone(saved):null,put:async(_key,value)=>{saved=structuredClone(value)}}},env={TABLES:{idFromName:x=>x,get:()=>table}},coordinator=new TournamentCoordinator(state,env);
 return{coordinator,controls,get provisionCalls(){return provisionCalls},blockProvision(){blockProvision=true},releaseProvision:provisionGate.resolve,waitProvision:()=>provisionSeen.promise,blockPause(){blockPause=true},releasePause:pauseGate.resolve,waitPause:()=>pauseSeen.promise};
}
async function initTwo(c){const r=await c.fetch(new Request('https://tournament/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'RACE01',players:[{name:'Host'},{name:'Guest'}],startingChips:2500,blindStructure:[[50,100],[75,150]],levelDurationMs:60000,now:1000})}));assert.equal(r.status,201)}

test('start locks registration before asynchronous child provisioning can finish',async()=>{
 const h=harness();await initTwo(h.coordinator);h.blockProvision();
 const startPromise=h.coordinator.fetch(new Request('https://tournament/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:2000})}));
 await h.waitProvision();
 const state=await (await h.coordinator.fetch(new Request('https://tournament/state'))).json();assert.equal(state.status,'starting');assert.equal(state.registrationOpen,false);assert.equal(state.controlTransition,'start');
 const late=await h.coordinator.fetch(new Request('https://tournament/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Late Seat'})}));assert.equal(late.status,409);assert.match((await late.json()).error,/start is in progress/i);
 const duplicate=await h.coordinator.fetch(new Request('https://tournament/start',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(duplicate.status,409);assert.equal(h.provisionCalls,1);
 h.releaseProvision();const started=await startPromise,j=await started.json();assert.equal(started.status,200);assert.equal(j.status,'running');assert.equal(j.controlTransition,null);assert.equal(j.players.length,2);
});

test('pause and resume cannot interleave and completed controls are idempotent',async()=>{
 const h=harness();await initTwo(h.coordinator);let r=await h.coordinator.fetch(new Request('https://tournament/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:2000})}));assert.equal(r.status,200);
 h.blockPause();const pausePromise=h.coordinator.fetch(new Request('https://tournament/pause',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:3000})}));await h.waitPause();
 const resumeDuringPause=await h.coordinator.fetch(new Request('https://tournament/resume',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:4000})}));assert.equal(resumeDuringPause.status,409);assert.match((await resumeDuringPause.json()).error,/pause is already in progress/i);
 h.releasePause();r=await pausePromise;assert.equal(r.status,200);assert.equal((await r.json()).status,'paused');
 const pausedAt=h.coordinator.data.clock.pausedAt;r=await h.coordinator.fetch(new Request('https://tournament/pause',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:4500})}));assert.equal(r.status,200);assert.equal(h.coordinator.data.clock.pausedAt,pausedAt);
 r=await h.coordinator.fetch(new Request('https://tournament/resume',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:5000})}));assert.equal(r.status,200);assert.equal((await r.json()).status,'running');const levelStarted=h.coordinator.data.clock.levelStartedAt;
 r=await h.coordinator.fetch(new Request('https://tournament/resume',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:6000})}));assert.equal(r.status,200);assert.equal(h.coordinator.data.clock.levelStartedAt,levelStarted);
});
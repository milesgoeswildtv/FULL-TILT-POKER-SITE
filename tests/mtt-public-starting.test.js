import test from'node:test';
import assert from'node:assert/strict';
import{handleTournamentApi}from'../worker/mtt-public.js';

test('public table proxy blocks play while the coordinator is still starting child tables',async()=>{
 let touched=false;
 const tournament={fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/session')return new Response(JSON.stringify({session:{playerId:'p01',host:true,provisioned:true,tableKey:'ABC123-T1',tableNumber:1,seat:1},tournament:{code:'ABC123',status:'starting',controlTransition:'start'}}),{headers:{'content-type':'application/json'}});throw Error('unexpected tournament route')}};
 const env={TOURNAMENTS:{idFromName:x=>x,get:()=>tournament},TABLES:{idFromName:x=>x,get:()=>({fetch:async()=>{touched=true;return new Response('{}')}})}};
 const r=await handleTournamentApi(new Request('https://fulltilt.test/api/tournaments/ABC123/table?token=real-token'),env),j=await r.json();
 assert.equal(r.status,409);assert.match(j.error,/still being prepared/i);assert.equal(touched,false);
});
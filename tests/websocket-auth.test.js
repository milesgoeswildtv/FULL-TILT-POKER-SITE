import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/app.js';

function tableWithSessions(){const table=new PokerTable({storage:{}},{});table.data={players:[{id:'p1',token:'player-token',name:'Player',chips:2500,stats:{}}],spectators:[{id:'s1',token:'spectator-token',name:'Spectator'}],street:'waiting'};return table}

test('table websocket rejects an unknown viewer token before upgrade',async()=>{
 const table=tableWithSessions(),res=await table.fetch(new Request('https://table/websocket?token=not-a-session',{headers:{Upgrade:'websocket'}}));
 assert.equal(res.status,403);
 assert.match((await res.json()).error,/invalid table session/i);
});

test('table websocket rejects a missing viewer token before upgrade',async()=>{
 const table=tableWithSessions(),res=await table.fetch(new Request('https://table/websocket',{headers:{Upgrade:'websocket'}}));
 assert.equal(res.status,403);
});

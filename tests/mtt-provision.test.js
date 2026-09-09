import test from'node:test';import assert from'node:assert/strict';
import{tournamentTableKey,childTablePayload}from'../worker/mtt-provision.js';

test('child table keys are stable and unique inside a tournament',()=>{assert.equal(tournamentTableKey('abc123',1),'ABC123-T1');assert.equal(tournamentTableKey('abc123',7),'ABC123-T7');assert.notEqual(tournamentTableKey('abc123',1),tournamentTableKey('abc123',2))});

test('50-player tournament payload keeps each child table at eight seats or fewer',()=>{const players=Array.from({length:50},(_,i)=>({id:`p${i+1}`,token:`t${i+1}`,name:`Player ${i+1}`,chips:2500,seat:i<8?i+1:1,moveCount:0})),table={tableNumber:1,playerIds:players.slice(0,8).map(p=>p.id)},tournament={code:'FT5000',startingChips:2500,players,clock:{blindStructure:[[50,100],[75,150]],levelDurationMs:150000}};const payload=childTablePayload(tournament,table);assert.equal(payload.code,'FT5000-T1');assert.equal(payload.players.length,8);assert.deepEqual(payload.players.map(p=>p.seat),[1,2,3,4,5,6,7,8]);assert.equal(payload.blindMinutes,2.5)});

test('child payload preserves tournament player identity, stack and token',()=>{const tournament={code:'MOVE01',startingChips:5000,players:[{id:'p01',token:'secret',name:'Sam',chips:8125,seat:3,moveCount:2}],clock:{blindStructure:[[100,200]],levelDurationMs:300000}},table={tableNumber:4,playerIds:['p01']};const payload=childTablePayload(tournament,table);assert.deepEqual(payload.players[0],{tournamentPlayerId:'p01',token:'secret',name:'Sam',chips:8125,seat:3,moveCount:2})});

import test from'node:test';
import assert from'node:assert/strict';
import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY}from'../worker/mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand}from'../worker/tournament-clock.js';

test('50 entrants allocate across seven shared 8-max tables',()=>{
 const players=Array.from({length:50},(_,i)=>({id:`p${i+1}`,moveCount:0}));
 const{tables,assignments}=initialAssignments(players);
 assert.equal(tables.length,7);assert.deepEqual(tables.map(t=>t.players.length),[8,7,7,7,7,7,7]);
 assert.equal(assignments.length,MTT_MAX_PLAYERS);assert.ok(tables.every(t=>t.players.length<=MTT_TABLE_CAPACITY));
});

test('all tables read one clock but live hands retain their snapshot',()=>{
 const structure=[[50,100],[75,150],[100,200]],clock=createTournamentClock({blindStructure:structure,levelDurationMs:150000,now:1000});
 const handA=blindsForNewHand(clock,149000);assert.deepEqual(handA,{blindLevel:0,smallBlind:50,bigBlind:100,ante:0});
 const globalAfter=tournamentClockState(clock,151000);assert.equal(globalAfter.blindLevel,1);assert.equal(globalAfter.smallBlind,75);assert.equal(globalAfter.bigBlind,150);
 assert.deepEqual(handA,{blindLevel:0,smallBlind:50,bigBlind:100,ante:0});
 const handB=blindsForNewHand(clock,151000);assert.deepEqual(handB,{blindLevel:1,smallBlind:75,bigBlind:150,ante:0});
});

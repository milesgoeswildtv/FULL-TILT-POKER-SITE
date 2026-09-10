import test from'node:test';
import assert from'node:assert/strict';
import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY}from'../worker/mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand}from'../worker/tournament-clock.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';

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

function coordinatorWithSizes(sizes){let n=0;const players=[],tables=sizes.map((size,i)=>{const playerIds=[];for(let seat=1;seat<=size;seat++){const id=`p${++n}`;players.push({id,token:`t${n}`,name:id,chips:2500,eliminated:false,finishPlace:null,moveCount:0,tableNumber:i+1,seat,handStartChips:2500,stats:{},cosmetic:'default'});playerIds.push(id)}return{tableNumber:i+1,tableKey:`TEST-T${i+1}`,capacity:8,playerIds,status:'running',provisioned:true}});const c=new TournamentCoordinator({storage:{}},{});c.data={code:'TEST',status:'running',startingChips:2500,players,tables,pendingMoves:[],clock:createTournamentClock({blindStructure:[[50,100],[75,150]],levelDurationMs:150000,now:1000})};return c}

test('coordinator owns global elimination places instead of trusting a child table place',()=>{const c=coordinatorWithSizes([2]);c.reportTable(1,{handNumber:4,status:'running',players:[{id:'p1',name:'p1',chips:5000,handStartChips:2500,stats:{handsPlayed:4}},{id:'p2',name:'p2',chips:0,eliminated:true,finishPlace:99,handStartChips:2500,stats:{handsPlayed:4}}]});assert.equal(c.player('p2').finishPlace,2);assert.equal(c.player('p1').finishPlace,1);assert.equal(c.data.status,'finished')});

test('balance move is scheduled only when its source table reaches a safe boundary',()=>{const c=coordinatorWithSizes([8,6]);assert.deepEqual(c.maybeScheduleMoves(2),[]);const moves=c.maybeScheduleMoves(1);assert.equal(moves.length,1);assert.equal(moves[0].fromTable,1);assert.equal(moves[0].toTable,2);assert.equal(c.data.pendingMoves.length,1);assert.equal(c.player(moves[0].playerId).tableNumber,2)});

test('table break relocates every active source player and closes the source table',()=>{const c=coordinatorWithSizes([2,3]);const moves=c.maybeScheduleMoves(1);assert.equal(moves.length,2);assert.equal(c.table(1).status,'closed');assert.equal(c.table(1).playerIds.length,0);assert.equal(c.table(2).playerIds.length,5);assert.equal(c.data.pendingMoves.filter(m=>!m.acknowledged).length,2)});

test('a moved player can be acknowledged by the destination table before another move is planned',()=>{const c=coordinatorWithSizes([8,6]),move=c.maybeScheduleMoves(1)[0];assert.equal(c.acknowledgeMoves(2,[move.id]).length,1);assert.equal(c.data.pendingMoves[0].acknowledged,true)});

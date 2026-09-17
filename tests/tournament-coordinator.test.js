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

function coordinatorWithSizes(sizes){
 let n=0;const players=[],tables=sizes.map((size,i)=>{const tableNumber=i+1,playerIds=[];for(let seat=1;seat<=size;seat++){const id=`p${++n}`;players.push({id,token:`t${n}`,name:id,chips:2500,eliminated:false,finishPlace:null,moveCount:0,tableNumber,seat,handStartChips:2500,stats:{},cosmetic:'default',ownershipGeneration:1,reportOwnerTable:tableNumber,pendingMoveId:null});playerIds.push(id)}return{tableNumber,tableKey:`TEST-T${tableNumber}`,capacity:8,playerIds,status:'running',handNumber:0,reportGeneration:1,lastBoundarySequence:0,lastBoundaryFingerprint:null,nextBigBlindPlayerId:playerIds.length>=2?playerIds[Math.min(2,playerIds.length-1)]:null,provisioned:true}});
 const c=new TournamentCoordinator({storage:{async put(){}}},{});c.data={code:'TEST',status:'running',startingChips:2500,players,tables,pendingMoves:[],eliminationLedger:[],clock:createTournamentClock({blindStructure:[[50,100],[75,150]],levelDurationMs:150000,now:1000})};return c;
}
function reportRow(p,{chips=p.chips,handStartChips=p.handStartChips,stats=p.stats}={}){return{id:p.id,ownershipGeneration:p.ownershipGeneration,name:p.name,chips,handStartChips,stats,cosmetic:p.cosmetic}}

test('coordinator owns global elimination places instead of trusting a child table place',()=>{const c=coordinatorWithSizes([2]),p1=c.player('p1'),p2=c.player('p2');const outcome=c.reportTable(1,{reportGeneration:1,boundarySequence:1,handNumber:1,completedAt:2000,status:'running',nextBigBlindPlayerId:null,players:[reportRow(p1,{chips:5000,handStartChips:2500,stats:{handsPlayed:1}}),{...reportRow(p2,{chips:0,handStartChips:2500,stats:{handsPlayed:1}}),eliminated:true,finishPlace:99}]});assert.deepEqual(outcome.newlyBusted,['p2']);assert.equal(c.player('p2').finishPlace,2);assert.equal(c.player('p1').finishPlace,1);assert.equal(c.data.status,'finished')});

test('balance move is scheduled only when its source table reaches a safe boundary and selects its next big blind',()=>{const c=coordinatorWithSizes([8,6]),expected=c.table(1).nextBigBlindPlayerId;assert.deepEqual(c.maybeScheduleMoves(2),[]);const moves=c.maybeScheduleMoves(1),move=moves[0],p=c.player(move.playerId);assert.equal(moves.length,1);assert.equal(move.playerId,expected);assert.equal(move.fromTable,1);assert.equal(move.toTable,2);assert.equal(move.toSeat,null);assert.equal(c.data.pendingMoves.length,1);assert.equal(p.tableNumber,2);assert.equal(p.seat,null);assert.equal(p.reportOwnerTable,null);assert.equal(p.pendingMoveId,move.id);assert.equal(p.ownershipGeneration,move.toOwnershipGeneration);assert.equal(c.table(1).reportGeneration,2)});

test('table break relocates every active source player and closes the source table',()=>{const c=coordinatorWithSizes([2,3]);const moves=c.maybeScheduleMoves(1);assert.equal(moves.length,2);assert.equal(c.table(1).status,'closed');assert.equal(c.table(1).playerIds.length,0);assert.equal(c.table(2).playerIds.length,5);assert.equal(c.data.pendingMoves.filter(m=>!m.acknowledged).length,2);assert.ok(moves.every(m=>Number.isInteger(m.toSeat)));assert.ok(moves.every(m=>c.player(m.playerId).reportOwnerTable===null))});

test('destination acknowledgement canonically assigns a deferred balance seat and transfers report ownership',()=>{const c=coordinatorWithSizes([8,6]),move=c.maybeScheduleMoves(1)[0],beforePending=c.data.pendingMoves.length;assert.throws(()=>c.acknowledgeMoves(2,[move.id]),/valid destination seat/);assert.throws(()=>c.acknowledgeMoves(2,[{id:move.id,seat:1}]),/occupied/);assert.equal(c.acknowledgeMoves(2,[{id:move.id,seat:7}]).length,1);assert.equal(c.data.pendingMoves[0].acknowledged,true);const p=c.player(move.playerId);assert.equal(p.seat,7);assert.equal(c.data.pendingMoves[0].toSeat,7);assert.equal(p.reportOwnerTable,2);assert.equal(p.pendingMoveId,null);assert.equal(c.table(2).reportGeneration,2);assert.equal(c.data.pendingMoves.length,beforePending);const notice=c.data.telegramNotifications?.find(x=>x.id===`move:${move.id}`);assert.equal(notice?.kind,'table-move');assert.equal(notice?.toTable,2);assert.equal(notice?.toSeat,7)});

test('a singleton table parked at an accepted boundary can trigger a safe table break while polling',async()=>{const c=coordinatorWithSizes([1,1,1]);const response=await c.fetch(new Request('https://tournament/tables/3/sync?atBoundary=1'));assert.equal(response.ok,true);assert.equal(c.table(3).status,'closed');assert.equal(c.data.pendingMoves.filter(m=>!m.acknowledged).length,1);const move=c.data.pendingMoves.find(m=>!m.acknowledged);assert.equal(move.fromTable,3);assert.equal(c.player(move.playerId).reportOwnerTable,null)});


test('Telegram notification outbox de-duplicates the same tournament event',()=>{const c=coordinatorWithSizes([2]);const event={id:'start:2000:p1',kind:'tournament-start',playerId:'p1',code:'TEST01',tableNumber:1,seat:1};assert.equal(c.queueTelegramNotification(event),true);assert.equal(c.queueTelegramNotification(event),false);assert.equal(c.data.telegramNotifications.length,1)});

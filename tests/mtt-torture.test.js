import test from'node:test';
import assert from'node:assert/strict';
import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY}from'../worker/mtt.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{createTournamentClock,blindsForNewHand,tournamentClockState,pauseTournamentClock,resumeTournamentClock}from'../worker/tournament-clock.js';

const STARTING_CHIPS=2500;
const TOTAL_CHIPS=STARTING_CHIPS*MTT_MAX_PLAYERS;
const BLINDS=[[10,20],[15,30],[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000],[750,1500],[1000,2000],[1500,3000],[2500,5000],[5000,10000],[10000,20000],[25000,50000],[50000,100000]];
const EMPTY_STATS=()=>({handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0});

function rngFor(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function randInt(rng,max){return Math.floor(rng()*max)}
function shuffled(rng,list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=randInt(rng,i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function activePlayer(p){return!p.eliminated&&p.chips>0}
function activeAt(coordinator,tableNumber){const t=coordinator.table(tableNumber);return(t?.playerIds||[]).map(id=>coordinator.player(id)).filter(p=>p&&activePlayer(p))}

function buildTournament(seed){
 const players=Array.from({length:MTT_MAX_PLAYERS},(_,i)=>({id:`p${String(i+1).padStart(2,'0')}`,token:`sim-${seed}-${i+1}`,name:`Player ${String(i+1).padStart(2,'0')}`,chips:STARTING_CHIPS,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:STARTING_CHIPS,stats:EMPTY_STATS(),cosmetic:['default','constellation','deadMansHand','regalia'][i%4],host:i===0}));
 const seating=initialAssignments(players);for(const a of seating.assignments){const p=players.find(x=>x.id===a.playerId);p.tableNumber=a.tableNumber;p.seat=a.seat}
 const tables=seating.tables.map(t=>({tableNumber:t.tableNumber,tableKey:`SIM${seed}-T${t.tableNumber}`,capacity:MTT_TABLE_CAPACITY,playerIds:t.players.map(p=>p.playerId),status:'running',handNumber:0,lastReportAt:null,provisioned:true}));
 const coordinator=new TournamentCoordinator({storage:{}},{});coordinator.data={code:`SIM${seed}`,status:'running',startingChips:STARTING_CHIPS,players,tables,pendingMoves:[],clock:createTournamentClock({blindStructure:BLINDS,levelDurationMs:30000,now:1000000}),createdAt:1000000,startedAt:1000000,finishedAt:null};
 const childRosters=new Map(tables.map(t=>[t.tableNumber,new Set(t.playerIds)]));return{coordinator,childRosters,now:1000000};
}

function recordMoves(coordinator,moves,stats,now){for(const move of moves||[]){stats.moves++;if(move.kind==='break')stats.breakMoves++;else stats.balanceMoves++;const p=coordinator.player(move.playerId);assert.equal(move.stack,p.chips,'move must preserve exact stack');const session=coordinator.sessionState(move.playerToken,now).session;assert.equal(session.playerId,move.playerId);assert.equal(session.tableNumber,move.toTable,'reconnect must resolve to destination immediately');assert.equal(session.seat,move.toSeat);stats.reconnectChecks++}}

function syncBoundary(coordinator,childRosters,tableNumber,stats,now){
 const table=coordinator.table(tableNumber);if(!table)return;
 let snapshot=coordinator.tableSnapshot(tableNumber,now);childRosters.set(tableNumber,new Set(snapshot.players.map(p=>p.id)));
 const incoming=(coordinator.data.pendingMoves||[]).filter(m=>!m.acknowledged&&m.toTable===tableNumber&&childRosters.get(tableNumber).has(m.playerId));
 if(incoming.length){for(const move of incoming){const s=coordinator.sessionState(move.playerToken,now).session;assert.equal(s.tableNumber,tableNumber);stats.reconnectChecks++}const acked=coordinator.acknowledgeMoves(tableNumber,incoming.map(m=>m.id));assert.equal(acked.length,incoming.length);stats.moveAcks+=acked.length;const follow=coordinator.maybeScheduleMoves(tableNumber);recordMoves(coordinator,follow,stats,now);snapshot=coordinator.tableSnapshot(tableNumber,now);childRosters.set(tableNumber,new Set(snapshot.players.map(p=>p.id)))}
 if(table.status==='closed')assert.equal(childRosters.get(tableNumber).size,0,'closed child table must reconcile empty');
}

function reportIdleBoundary(coordinator,childRosters,tableNumber,stats,now){
 const ids=[...(childRosters.get(tableNumber)||[])],rows=ids.map(id=>coordinator.player(id)).filter(Boolean).map(p=>({id:p.id,name:p.name,chips:p.chips,handStartChips:p.chips,stats:p.stats,cosmetic:p.cosmetic}));
 coordinator.reportTable(tableNumber,{handNumber:coordinator.table(tableNumber)?.handNumber||0,status:'running',players:rows});const moves=coordinator.maybeScheduleMoves(tableNumber);recordMoves(coordinator,moves,stats,now);syncBoundary(coordinator,childRosters,tableNumber,stats,now);
}

function simulateHand(coordinator,childRosters,tableNumber,rng,stats,now,forceBust=false){
 const localIds=[...(childRosters.get(tableNumber)||[])],players=localIds.map(id=>coordinator.player(id)).filter(p=>p&&activePlayer(p));if(players.length<2){reportIdleBoundary(coordinator,childRosters,tableNumber,stats,now);return{now,busts:0}}
 const handBlinds=blindsForNewHand(coordinator.data.clock,now),startLevel=handBlinds.blindLevel,start=new Map(players.map(p=>[p.id,p.chips])),next=new Map(start),winner=players[randInt(rng,players.length)],others=shuffled(rng,players.filter(p=>p!==winner)),loserCount=1+randInt(rng,Math.min(3,others.length)),losers=others.slice(0,loserCount);let pot=0,busts=0;
 for(let i=0;i<losers.length;i++){const loser=losers[i],stack=next.get(loser.id),bust=stack<=1||forceBust&&i===0||rng()<.20;let amount;if(bust)amount=stack;else amount=Math.max(1,Math.floor(stack*(.04+rng()*.32)));if(!bust)amount=Math.min(stack-1,amount);next.set(loser.id,stack-amount);pot+=amount;if(amount===stack)busts++}
 next.set(winner.id,next.get(winner.id)+pot);
 const rows=players.map(p=>{const statsNext={...p.stats,handsPlayed:(p.stats?.handsPlayed||0)+1};if(p===winner){statsNext.handsWon=(statsNext.handsWon||0)+1;statsNext.biggestPotWon=Math.max(statsNext.biggestPotWon||0,pot)}if(rng()<.55)statsNext.vpipHands=Math.min(statsNext.handsPlayed,(statsNext.vpipHands||0)+1);if(rng()<.18)statsNext.pfrHands=Math.min(statsNext.handsPlayed,(statsNext.pfrHands||0)+1);return{id:p.id,name:p.name,chips:next.get(p.id),handStartChips:start.get(p.id),stats:statsNext,cosmetic:p.cosmetic}});
 const duration=2000+randInt(rng,43001),endNow=now+duration,newlyBusted=coordinator.reportTable(tableNumber,{handNumber:(coordinator.table(tableNumber)?.handNumber||0)+1,status:'running',players:rows});assert.equal(newlyBusted.length,busts);stats.hands++;stats.eliminations+=busts;
 const moves=coordinator.maybeScheduleMoves(tableNumber);recordMoves(coordinator,moves,stats,endNow);syncBoundary(coordinator,childRosters,tableNumber,stats,endNow);const nextBlinds=blindsForNewHand(coordinator.data.clock,endNow);if(nextBlinds.blindLevel!==startLevel)stats.levelCrossingHands++;assert.equal(handBlinds.blindLevel,startLevel,'live hand blind snapshot mutated');return{now:endNow,busts};
}

function assertClockConsistency(coordinator,now){const tables=coordinator.data.tables.filter(t=>t.status!=='closed');if(!tables.length)return;const expected=blindsForNewHand(coordinator.data.clock,now);for(const table of tables){const snapshot=coordinator.tableSnapshot(table.tableNumber,now);assert.deepEqual(snapshot.handBlinds,expected);assert.equal(snapshot.fieldRemaining,coordinator.data.players.filter(activePlayer).length)}}

function assertInvariants(coordinator,childRosters){
 const players=coordinator.data.players,total=players.reduce((n,p)=>n+p.chips,0);assert.equal(total,TOTAL_CHIPS,'global chip conservation failed');assert.ok(players.every(p=>Number.isInteger(p.chips)&&p.chips>=0),'chip stacks must stay non-negative integers');
 const active=players.filter(activePlayer),seen=new Map(),unacked=(coordinator.data.pendingMoves||[]).filter(m=>!m.acknowledged),movingIds=new Set(unacked.map(m=>m.playerId));assert.equal(movingIds.size,unacked.length,'a player cannot have two live table moves');
 for(const table of coordinator.data.tables){const canonical=activeAt(coordinator,table.tableNumber),seats=new Set();assert.ok(canonical.length<=table.capacity,'table exceeded capacity');for(const p of canonical){assert.equal(p.tableNumber,table.tableNumber);assert.ok(p.seat>=1&&p.seat<=table.capacity);assert.ok(!seats.has(p.seat),'duplicate canonical seat');seats.add(p.seat)}const roster=childRosters.get(table.tableNumber)||new Set();if(table.status==='closed'){assert.equal(canonical.length,0,'closed table retained active player');assert.equal(roster.size,0,'closed child roster retained player')}for(const id of roster){const p=coordinator.player(id);assert.ok(p&&activePlayer(p),'child roster retained busted player');assert.equal(p.tableNumber,table.tableNumber,'child roster points at stale table');seen.set(id,(seen.get(id)||0)+1)}}
 for(const p of active){const n=seen.get(p.id)||0;if(movingIds.has(p.id))assert.equal(n,0,'in-transit player was dealt at a child table');else assert.equal(n,1,'active player must exist at exactly one child table')}
 for(const p of players.filter(p=>p.eliminated)){assert.equal(p.chips,0,'eliminated player retained chips');assert.ok(Number.isInteger(p.finishPlace)&&p.finishPlace>=2,'eliminated player missing global finish place')}
 const places=players.map(p=>p.finishPlace).filter(Number.isInteger);assert.equal(new Set(places).size,places.length,'duplicate finishing position');
}

function maybePause(coordinator,rng,stats,now){if(rng()>=.035||coordinator.data.status!=='running')return now;const before=tournamentClockState(coordinator.data.clock,now);pauseTournamentClock(coordinator.data.clock,now);coordinator.data.status='paused';const resumeAt=now+5000+randInt(rng,90001),during=tournamentClockState(coordinator.data.clock,resumeAt);assert.equal(during.blindLevel,before.blindLevel);assert.equal(during.remainingMs,before.remainingMs,'blind clock moved while tournament was paused');resumeTournamentClock(coordinator.data.clock,resumeAt);coordinator.data.status='running';stats.pauses++;return resumeAt}

function finishPendingMoves(coordinator,childRosters,stats,now){for(let guard=0;guard<30;guard++){const pending=(coordinator.data.pendingMoves||[]).filter(m=>!m.acknowledged);if(!pending.length)return;for(const tableNumber of new Set(pending.map(m=>m.toTable)))syncBoundary(coordinator,childRosters,tableNumber,stats,now)}throw Error('pending table moves did not settle')}

function runTournament(seed){
 const rng=rngFor(seed),sim=buildTournament(seed),{coordinator,childRosters}=sim,stats={hands:0,eliminations:0,moves:0,balanceMoves:0,breakMoves:0,moveAcks:0,reconnectChecks:0,pauses:0,levelCrossingHands:0};let now=sim.now,quietHands=0;
 assert.deepEqual(coordinator.data.tables.map(t=>t.playerIds.length),[8,7,7,7,7,7,7]);assertInvariants(coordinator,childRosters);
 for(let cycle=0;cycle<2000&&coordinator.data.status!=='finished';cycle++){
  now=maybePause(coordinator,rng,stats,now);const open=shuffled(rng,coordinator.data.tables.filter(t=>t.status!=='closed'));
  for(const table of open){if(coordinator.data.status==='finished')break;const result=simulateHand(coordinator,childRosters,table.tableNumber,rng,stats,now,quietHands>=5);now=result.now;quietHands=result.busts?0:quietHands+1;if(rng()<.14){const live=coordinator.data.players.filter(activePlayer);if(live.length){const p=live[randInt(rng,live.length)],session=coordinator.sessionState(p.token,now).session;assert.equal(session.playerId,p.id);assert.equal(session.tableNumber,p.tableNumber);assert.equal(session.seat,p.seat);stats.reconnectChecks++}}assertClockConsistency(coordinator,now);assertInvariants(coordinator,childRosters)}
 }
 assert.equal(coordinator.data.status,'finished',`seed ${seed} failed to finish`);finishPendingMoves(coordinator,childRosters,stats,now);assertInvariants(coordinator,childRosters);const winner=coordinator.data.players.find(p=>p.finishPlace===1),active=coordinator.data.players.filter(activePlayer);assert.equal(active.length,1);assert.equal(winner?.id,active[0].id);assert.equal(winner.chips,TOTAL_CHIPS,'winner must own every tournament chip');assert.deepEqual(coordinator.data.players.map(p=>p.finishPlace).sort((a,b)=>a-b),Array.from({length:MTT_MAX_PLAYERS},(_,i)=>i+1));assert.equal(stats.eliminations,MTT_MAX_PLAYERS-1);assert.ok(stats.breakMoves>0,'simulation never exercised a table break');assert.ok(stats.balanceMoves>0,'simulation never exercised a balance move');assert.ok(stats.reconnectChecks>0);assert.ok(stats.levelCrossingHands>0,'simulation never crossed a blind level during a live hand');return stats;
}

test('500 seeded 50-player MTTs conserve chips, survive moves, reconnects, pauses, blind rollovers and finish cleanly',()=>{const aggregate={hands:0,moves:0,breakMoves:0,balanceMoves:0,pauses:0,reconnectChecks:0,levelCrossingHands:0};for(let seed=1;seed<=500;seed++){const stats=runTournament(seed);for(const key of Object.keys(aggregate))aggregate[key]+=stats[key]}assert.ok(aggregate.hands>10000);assert.ok(aggregate.moves>1000);assert.ok(aggregate.breakMoves>1000);assert.ok(aggregate.balanceMoves>100);assert.ok(aggregate.pauses>0);console.log('MTT torture summary',aggregate)});

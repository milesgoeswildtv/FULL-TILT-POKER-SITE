import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/index.js';
import{applyTournamentBlinds}from'../worker/mtt-table-link.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand}from'../worker/tournament-clock.js';

function player(id,name,chips){
 return{id,token:`t-${id}`,name,chips,bet:0,contributed:0,host:false,folded:false,eliminated:false,finishPlace:null,cards:[],stats:{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0},handStartChips:chips,vpipThisHand:false,pfrThisHand:false};
}
function table(stacks,{ante=0,sb=50,bb=100}={}){
 const state={storage:{put:async()=>{},setAlarm:()=>{},deleteAlarm:()=>{}},getWebSockets:()=>[]},t=new PokerTable(state,{});
 t.data={code:'ANTE01',startingChips:2500,blindMinutes:10,blindLevel:0,smallBlind:sb,bigBlind:bb,ante,levelStartedAt:1,started:true,paused:false,players:stacks.map((s,i)=>player(`p${i+1}`,`P${i+1}`,s)),board:[],burned:[],pot:0,deck:[],dealerIndex:stacks.length-1,turnIndex:0,currentBet:0,openingBet:0,minRaise:bb,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null};
 t.newHand();return t;
}

test('big blind ante is a dead contribution and does not reduce the preflop call',()=>{
 const t=table([1000,1000,1000],{ante:100});
 const[d,sb,bb]=t.data.players;
 assert.equal(t.data.dealerIndex,0);
 assert.equal(sb.bet,50);
 assert.equal(sb.contributed,50);
 assert.equal(bb.bet,100);
 assert.equal(bb.contributed,200);
 assert.equal(bb.chips,800);
 assert.equal(t.data.pot,250);
 assert.equal(t.betToMatch(),100);
 assert.equal(t.toCall(d),100);
 assert.equal(t.toCall(sb),50);
 assert.equal(t.toCall(bb),0);
 assert.equal(bb.contributed-bb.bet,100);
});

test('short big blind posts ante first but the opening amount remains a full big blind',()=>{
 const t=table([1000,1000,80],{ante:100});
 const[d,sb,bb]=t.data.players;
 assert.equal(bb.chips,0);
 assert.equal(bb.contributed,80);
 assert.equal(bb.bet,0);
 assert.equal(t.data.pot,130);
 assert.equal(t.betToMatch(),100);
 assert.equal(t.toCall(d),100);
 assert.equal(t.toCall(sb),50);
});

test('short-BB ante hand settles without losing or inventing chips',()=>{
 const t=table([1000,1000,80],{ante:100});
 const[p1,p2]=t.data.players;
 t.act(p1,'call',0);
 t.act(p2,'call',0);
 assert.equal(t.data.pot,280);
 assert.equal(t.data.street,'flop');
 for(const street of['flop','turn','river']){
  assert.equal(t.data.street,street);
  const first=t.data.players[t.data.turnIndex];t.act(first,'check',0);
  const second=t.data.players[t.data.turnIndex];t.act(second,'check',0);
 }
 assert.equal(t.data.street,'showdown');
 assert.equal(t.data.lastResult.settledPot,280);
 assert.equal((t.data.lastResult.pots||[]).reduce((n,p)=>n+Number(p.amount||0),0),280);
 const chips=t.data.players.reduce((n,p)=>n+Number(p.chips||0),0);
 assert.equal(chips,2080);
});

test('ordinary tables remain blind-only when ante is zero',()=>{
 const t=table([1000,1000,1000],{ante:0});
 assert.equal(t.data.pot,150);
 assert.equal(t.data.players[2].contributed,100);
 assert.equal(t.data.players[2].bet,100);
 assert.equal(t.data.ante,0);
});

test('MTT hand snapshot applies authoritative BBA amount and mode',()=>{
 const d={smallBlind:25,bigBlind:50,minRaise:50,ante:0};
 const snapshot={status:'running',anteMode:'big-blind',clock:{blindLevel:2,smallBlind:50,bigBlind:100,ante:100,remainingMs:1000},handBlinds:{blindLevel:2,smallBlind:50,bigBlind:100,ante:100}};
 assert.equal(applyTournamentBlinds(d,snapshot),true);
 assert.equal(d.smallBlind,50);
 assert.equal(d.bigBlind,100);
 assert.equal(d.ante,100);
 assert.equal(d.anteMode,'big-blind');
});

test('tournament clock preserves ante in each hand-level snapshot',()=>{
 const clock=createTournamentClock({blindStructure:[[50,100,100],[75,150,150]],levelDurationMs:60000,now:1000});
 assert.equal(tournamentClockState(clock,1000).ante,100);
 assert.deepEqual(blindsForNewHand(clock,61000),{blindLevel:1,smallBlind:75,bigBlind:150,ante:150});
});

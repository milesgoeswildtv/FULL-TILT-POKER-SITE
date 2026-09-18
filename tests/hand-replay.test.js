import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/app.js';
import{createHandReplay,appendReplayStep,cloneHandReplay,rabbitRunout}from'../worker/hand-replay.js';

function state(){return{storage:{put:async()=>{},setAlarm:()=>{},deleteAlarm:()=>{}},getWebSockets:()=>[]}}
function stats(){return{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0,chipsWon:0}}
function player(id,name,chips=1000){return{id,token:'token-'+id,name,chips,bet:0,contributed:0,host:id==='a',folded:false,eliminated:false,finishPlace:null,cards:[],stats:stats(),handStartChips:chips,vpipThisHand:false,pfrThisHand:false,cosmetic:'default',accountId:null,sittingOut:false,timeBankMs:60000}}
function game(){
 return{code:'RABBIT',startingChips:1000,blindMinutes:10,blindLevel:0,smallBlind:10,bigBlind:20,ante:0,levelStartedAt:Date.now(),started:true,paused:false,players:[player('a','A'),player('b','B')],board:[],burned:[],pot:0,deck:[],dealerIndex:1,turnIndex:0,currentBet:0,openingBet:0,minRaise:20,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null,spectators:[],chat:[],blindStructure:[[10,20],[20,40]],actionLog:[],mttMoveNotices:{},accountStatsDirty:false,mttBoundaryReportedSequence:0,mttSyncFailureCount:0,turnSerial:0,turnReminderAt:null,turnReminderSentSerial:0,handReplay:null,rabbitCandidate:null}
}

test('rabbit runout follows normal burn-card order without mutating the deck',()=>{
 const deck=['A','B','C','D','E','F','G','H'],before=[...deck];
 assert.deepEqual(rabbitRunout(deck,[]),['G','F','E','C','A']);
 assert.deepEqual(deck,before);
 assert.deepEqual(rabbitRunout(['A','B','C','D'],['2s','3s','4s']),['2s','3s','4s','C','A']);
});

test('replay snapshots contain table state but never player tokens or hidden hole cards',()=>{
 const d=game();d.handNumber=7;d.players[0].cards=['A♠','A♥'];d.players[1].cards=['K♠','K♥'];d.players[1].bet=20;d.players[1].contributed=20;d.players[1].chips=980;d.pot=20;
 const replay=createHandReplay(d,1234);appendReplayStep(replay,d,{type:'hand',text:'Hand started',at:1235});const clean=cloneHandReplay(replay),raw=JSON.stringify(clean);
 assert.equal(clean.handNumber,7);assert.equal(clean.steps.length,1);assert.equal(clean.steps[0].pot,20);
 assert.equal(raw.includes('token-a'),false);assert.equal(raw.includes('A♠'),false);assert.equal(raw.includes('K♠'),false);
});

test('uncontested real PokerTable hand can rabbit hunt without changing deck, board, or chip result',()=>{
 const t=new PokerTable(state(),{});t.data=game();t.newHand();
 const actor=t.data.players[t.data.turnIndex],chipsBefore=t.data.players.reduce((n,p)=>n+p.chips,0)+t.data.pot;
 t.act(actor,'fold',0);
 assert.equal(t.data.street,'showdown');assert.equal(t.data.lastResult.uncontested,true);assert.ok(t.data.rabbitCandidate);
 const boardBefore=[...t.data.board],deckBefore=[...t.data.deck],stacksBefore=t.data.players.map(p=>p.chips);
 assert.equal(t.rabbitHunt(actor),true);
 assert.deepEqual(t.data.board,boardBefore);assert.deepEqual(t.data.deck,deckBefore);assert.deepEqual(t.data.players.map(p=>p.chips),stacksBefore);
 assert.equal(t.data.lastResult.rabbitBoard.length,5);assert.equal(t.data.handHistory[0].rabbitBoard.length,5);
 assert.equal(t.data.handHistory[0].replay.steps.at(-1).type,'fold');
 assert.equal(t.data.handHistory[0].actionLog.at(-1).type,'rabbit');
 const pub=t.public(actor.token);assert.equal(pub.handHistory[0].replay,undefined);assert.equal(pub.handHistory[0].replayAvailable,true);
 const replay=t.replayHistory(t.data.handNumber);assert.ok(replay.replay.steps.length>=2);
 assert.equal(t.data.players.reduce((n,p)=>n+p.chips,0)+t.data.pot,chipsBefore);
 assert.equal(t.rabbitHunt(actor),false);
});

test('Rabbit Hunt is rejected for normal showdown hands',()=>{
 const t=new PokerTable(state(),{});t.data=game();t.newHand();
 t.data.lastResult={uncontested:false,board:['2♠','3♠','4♠','5♠','6♠']};t.data.street='showdown';t.data.phaseDeadline=Date.now()+5000;t.data.rabbitCandidate=null;
 assert.throws(()=>t.rabbitHunt(t.data.players[0]),/not available/i);
});


test('immediate short-stack runout still records a usable replay',()=>{
 const t=new PokerTable(state(),{}),d=game();d.players[1].chips=5;d.players[1].handStartChips=5;t.data=d;t.newHand();
 assert.equal(t.data.street,'showdown');assert.equal(t.data.handHistory.length,1);
 assert.ok(t.data.handHistory[0].replay?.steps?.length>=2);
 assert.equal(t.data.handHistory[0].replay.players.length,2);
});

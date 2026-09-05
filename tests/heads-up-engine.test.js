import test from'node:test';import assert from'node:assert/strict';import{PokerTable}from'../worker/index.js';

function fakeState(){return{storage:{setAlarm(){},deleteAlarm(){},put(){},get(){}},getWebSockets(){return[]}}}
function stats(){return{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0}}
function player(id,name){return{id,token:`t${id}`,name,chips:1000,bet:0,contributed:0,host:id==='a',folded:false,eliminated:false,finishPlace:null,cards:[],stats:stats(),handStartChips:1000,vpipThisHand:false,pfrThisHand:false}}
function game(dealerIndex=1){return{code:'ABC123',startingChips:1000,blindMinutes:10,blindLevel:0,smallBlind:10,bigBlind:20,levelStartedAt:Date.now(),started:true,paused:false,players:[player('a','A'),player('b','B')],board:[],burned:[],pot:0,deck:[],dealerIndex,turnIndex:0,currentBet:0,minRaise:20,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null}}

test('actual engine heads-up dealer is SB and first to act preflop',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game(1);table.newHand();
 // newHand rotates dealer from seat 1 to seat 0.
 assert.equal(table.data.dealerIndex,0);
 assert.equal(table.data.players[0].bet,10);
 assert.equal(table.data.players[1].bet,20);
 assert.equal(table.data.turnIndex,0);
 assert.equal(table.data.pot,30);
});

test('actual engine heads-up BB acts first postflop',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game(1);table.newHand();
 // Simulate a completed preflop round without changing stacks further.
 table.data.players[0].bet=20;table.data.players[0].chips-=10;table.data.players[0].contributed+=10;table.data.pot+=10;
 table.data.acted={a:true,b:true};table.data.actedAtBet={a:20,b:20};table.data.currentBet=20;
 table.nextStreet();
 assert.equal(table.data.street,'flop');
 assert.equal(table.data.turnIndex,1);
 assert.equal(table.data.players[table.data.turnIndex].id,'b');
});

test('heads-up dealer alternates every new hand',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game(1);table.newHand();
 assert.equal(table.data.dealerIndex,0);
 table.data.street='showdown';table.data.players.forEach(p=>{p.chips=1000;p.eliminated=false});
 table.newHand();
 assert.equal(table.data.dealerIndex,1);
 assert.equal(table.data.players[1].bet,10);
 assert.equal(table.data.players[0].bet,20);
 assert.equal(table.data.turnIndex,1);
});

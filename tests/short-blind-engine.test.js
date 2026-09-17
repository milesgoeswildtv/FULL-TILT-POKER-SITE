import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/index.js';

function fakeState(){return{storage:{setAlarm(){},deleteAlarm(){},put(){},get(){}},getWebSockets(){return[]}}}
function stats(){return{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0}}
function player(id,name,chips=1000){return{id,token:`t${id}`,name,chips,bet:0,contributed:0,host:id==='a',folded:false,eliminated:false,finishPlace:null,cards:[],stats:stats(),handStartChips:chips,vpipThisHand:false,pfrThisHand:false}}
function game(players,dealerIndex=players.length-1){return{code:'ABC123',startingChips:1000,blindMinutes:10,blindLevel:0,smallBlind:10,bigBlind:20,levelStartedAt:Date.now(),started:true,paused:false,players,board:[],burned:[],pot:0,deck:[],dealerIndex,turnIndex:0,currentBet:0,openingBet:0,minRaise:20,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null}}

test('short big blind does not reduce the multiway preflop opening obligation',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B'),player('c','C',5)],2);table.newHand();
 assert.equal(table.data.dealerIndex,0);assert.equal(table.data.players[1].bet,10);assert.equal(table.data.players[2].bet,5);
 assert.equal(table.data.currentBet,10);assert.equal(table.data.openingBet,20);assert.equal(table.betToMatch(),20);assert.equal(table.toCall(table.data.players[0]),20);
});

test('short small blind with a full big blind keeps the normal big-blind obligation',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B',5),player('c','C')],2);table.newHand();
 assert.equal(table.data.players[1].bet,5);assert.equal(table.data.players[2].bet,20);assert.equal(table.betToMatch(),20);assert.equal(table.toCall(table.data.players[0]),20);
});

test('when both blinds are short and only one player has chips, only actual opposing action must be matched',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B',5),player('c','C',7)],2);table.newHand();
 assert.equal(table.betToMatch(),7);assert.equal(table.toCall(table.data.players[0]),7);assert.equal(table.data.street,'preflop');
});

test('heads-up short big blind does not force a meaningless nominal blind call',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B',5)],1);const before=table.data.players.reduce((n,p)=>n+p.chips,0);table.newHand();
 assert.equal(table.data.street,'showdown');assert.equal(table.data.lastResult.returnedTotal,5);assert.equal(table.data.lastResult.returns[0].playerId,'a');assert.equal(table.data.players.reduce((n,p)=>n+p.chips,0),before);
});

test('player shorter than nominal big blind can call all-in without creating chips',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A',15),player('b','B'),player('c','C',5)],2);table.newHand();
 const actor=table.data.players[0];assert.equal(table.toCall(actor),20);table.act(actor,'call',0);assert.equal(actor.chips,0);assert.equal(actor.bet,15);assert.equal(actor.contributed,15);
});

test('minimum full raise is measured from nominal opening bet after a short big blind',()=>{
 const table=new PokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B'),player('c','C',5)],2);table.newHand();
 const actor=table.data.players[0];table.act(actor,'raise',40);assert.equal(actor.bet,40);assert.equal(table.data.minRaise,20);assert.equal(table.betToMatch(),40);
});

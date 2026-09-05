import test from'node:test';import assert from'node:assert/strict';
import{PokerTable as BasePokerTable}from'../worker/index.js';
import{PokerTable as AppPokerTable}from'../worker/app.js';

function fakeState(){return{storage:{setAlarm(){},deleteAlarm(){},put(){},get(){}},getWebSockets(){return[]}}}
function stats(){return{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0}}
function player(id,name,chips=1000,handStartChips=1000){return{id,token:`t${id}`,name,chips,bet:0,contributed:0,host:id==='a',folded:false,eliminated:false,finishPlace:null,cards:[],stats:stats(),handStartChips,vpipThisHand:false,pfrThisHand:false}}
function game(players){return{code:'ABC123',startingChips:1000,blindMinutes:10,blindLevel:0,smallBlind:10,bigBlind:20,levelStartedAt:Date.now(),started:true,paused:false,players,board:[],burned:[],pot:0,deck:[],dealerIndex:0,turnIndex:0,currentBet:0,minRaise:20,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null}}

test('simultaneous busts place larger starting stack ahead',()=>{
 const players=[player('a','A',1000,1000),player('b','B',0,600),player('c','C',0,300)];
 const table=new AppPokerTable(fakeState(),{});table.data=game(players);
 const result={pots:[]};table.finalizeStats(result);
 assert.equal(players[1].finishPlace,2);assert.equal(players[2].finishPlace,3);
 assert.deepEqual(result.knockouts,[{name:'B',place:2},{name:'C',place:3}]);
});

test('equal-stack simultaneous busts use stable seat order',()=>{
 const players=[player('a','A',1000,1000),player('b','B',0,500),player('c','C',0,500)];
 const table=new AppPokerTable(fakeState(),{});table.data=game(players);
 table.finalizeStats({pots:[]});
 assert.equal(players[1].finishPlace,2);assert.equal(players[2].finishPlace,3);
});

test('full preflop all-in runout produces five board cards and exactly three burns',()=>{
 const table=new BasePokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B')]);table.newHand();
 const before=table.data.deck.length;table.showdown=()=>{};table.runout();
 assert.equal(table.data.board.length,5);assert.equal(table.data.burned.length,3);assert.equal(before-table.data.deck.length,8);
});

test('runout from flop adds turn and river with one burn each',()=>{
 const table=new BasePokerTable(fakeState(),{});table.data=game([player('a','A'),player('b','B')]);table.newHand();
 table.burn();table.data.board.push(table.draw(),table.draw(),table.draw());
 const before=table.data.deck.length;table.showdown=()=>{};table.runout();
 assert.equal(table.data.board.length,5);assert.equal(table.data.burned.length,3);assert.equal(before-table.data.deck.length,4);
});

test('autoRunoutIfNeeded triggers when every live player is all-in',()=>{
 const table=new BasePokerTable(fakeState(),{});table.data=game([player('a','A',0),player('b','B',0)]);
 let called=false;table.runout=()=>{called=true};table.autoRunoutIfNeeded();assert.equal(called,true);
});

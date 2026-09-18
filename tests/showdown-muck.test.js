import test from'node:test';
import assert from'node:assert/strict';
import{showdownPresentation,revealMuckedHand,confirmMuck,visibleCards}from'../worker/showdown.js';
import{PokerTable}from'../worker/app.js';

const board=['2♣','3♦','7♠','8♥','9♣'];

test('normal showdown reveals contested-pot winners and mucks losing non-all-in hands',()=>{
 const players=[
  {id:'a',name:'A',token:'ta',chips:500,cards:['A♠','A♥'],folded:false,contributed:100},
  {id:'b',name:'B',token:'tb',chips:700,cards:['K♠','K♥'],folded:false,contributed:100}
 ];
 const pots=[{amount:200,winnerIds:['a'],winners:['A'],participantIds:['a','b']}];
 const result=showdownPresentation(players,pots);
 assert.deepEqual(result.revealed.map(x=>x.playerId),['a']);
 assert.deepEqual(result.mucked,[{playerId:'b',name:'B',confirmed:false}]);
 assert.equal('cards'in result.mucked[0],false);
 assert.deepEqual(visibleCards({player:players[1],viewerToken:'rail',street:'showdown',lastResult:result}),['','']);
});

test('all-in hands that reach showdown are shown even when they lose',()=>{
 const players=[
  {id:'a',name:'A',chips:0,cards:['A♠','A♥'],folded:false,contributed:100},
  {id:'b',name:'B',chips:0,cards:['K♠','K♥'],folded:false,contributed:100}
 ];
 const result=showdownPresentation(players,[{amount:200,winnerIds:['a'],winners:['A'],participantIds:['a','b']}]);
 assert.deepEqual(new Set(result.revealed.map(x=>x.playerId)),new Set(['a','b']));
 assert.equal(result.mucked.length,0);
});

test('every winner of any side pot is forced to show',()=>{
 const players=[
  {id:'a',name:'A',chips:400,cards:['A♠','A♥'],folded:false,contributed:300},
  {id:'b',name:'B',chips:300,cards:['K♠','K♥'],folded:false,contributed:300},
  {id:'c',name:'C',chips:200,cards:['Q♠','Q♥'],folded:false,contributed:100}
 ];
 const pots=[
  {amount:300,winnerIds:['c'],winners:['C'],participantIds:['a','b','c']},
  {amount:400,winnerIds:['a'],winners:['A'],participantIds:['a','b']}
 ];
 const result=showdownPresentation(players,pots);
 assert.deepEqual(new Set(result.revealed.map(x=>x.playerId)),new Set(['a','c']));
 assert.deepEqual(result.mucked.map(x=>x.playerId),['b']);
});

test('mucked loser may voluntarily show until explicit muck is confirmed',()=>{
 const lastResult={revealed:[],mucked:[{playerId:'b',name:'B',confirmed:false}]};
 const player={id:'b',name:'B',cards:['K♠','K♥'],folded:false};
 assert.equal(revealMuckedHand(lastResult,player),true);
 assert.deepEqual(lastResult.mucked,[]);
 assert.deepEqual(lastResult.revealed,[{playerId:'b',name:'B',cards:['K♠','K♥'],reason:'voluntary'}]);

 const locked={revealed:[],mucked:[{playerId:'b',name:'B',confirmed:false}]};
 assert.equal(confirmMuck(locked,player),true);
 assert.equal(locked.mucked[0].confirmed,true);
 assert.equal(revealMuckedHand(locked,player),false);
 assert.deepEqual(locked.revealed,[]);
});

test('folded hand can never be resurrected by show-hand action',()=>{
 const lastResult={revealed:[],mucked:[{playerId:'b',name:'B',confirmed:false}]};
 const player={id:'b',name:'B',cards:['K♠','K♥'],folded:true};
 assert.equal(revealMuckedHand(lastResult,player),false);
 assert.deepEqual(lastResult.revealed,[]);
});

test('PokerTable showdown choice updates live result and saved hand history together',()=>{
 const table=new PokerTable({storage:{}},{});
 const loser={id:'b',token:'tb',name:'B',cards:['K♠','K♥'],folded:false,eliminated:false,chips:500};
 table.data={
  handNumber:9,street:'showdown',phaseDeadline:Date.now()+10000,
  players:[loser],actionLog:[],
  lastResult:{summary:'A won 200',board:[...board],revealed:[{playerId:'a',name:'A',cards:['A♠','A♥'],reason:'winner'}],mucked:[{playerId:'b',name:'B',confirmed:false}]},
  handHistory:[{handNumber:9,summary:'A won 200',board:[...board],revealed:[{playerId:'a',name:'A',cards:['A♠','A♥'],reason:'winner'}],mucked:[{playerId:'b',name:'B',confirmed:false}],actionLog:[]}]
 };
 assert.equal(table.showdownChoice(loser,'showhand'),true);
 assert.equal(table.data.lastResult.mucked.length,0);
 assert.ok(table.data.lastResult.revealed.some(x=>x.playerId==='b'&&x.cards[0]==='K♠'));
 assert.equal(table.data.handHistory[0].mucked.length,0);
 assert.ok(table.data.handHistory[0].revealed.some(x=>x.playerId==='b'&&x.cards[1]==='K♥'));
 assert.ok(table.data.handHistory[0].actionLog.some(x=>x.type==='showhand'));
});

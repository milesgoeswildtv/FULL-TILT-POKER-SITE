import test from'node:test';
import assert from'node:assert/strict';
import{settleSidePots}from'../worker/pots.js';
const p=(id,name,contributed,cards,folded=false)=>({id,name,contributed,cards,folded});
function sumAwards(awards){return[...awards.values()].reduce((a,b)=>a+b,0)}
test('settles unequal all-ins into exact main and side pots',()=>{
 const players=[p('a','A',100,['A♠','A♥']),p('b','B',200,['K♠','K♥']),p('c','C',300,['Q♠','Q♥'])];
 const r=settleSidePots(players,['2♣','3♦','7♠','8♥','9♣'],0);
 assert.deepEqual(r.pots.map(x=>x.amount),[300,200,100]);
 assert.equal(r.total,600);assert.equal(sumAwards(r.awards),600);
 assert.equal(r.awards.get('a'),300);assert.equal(r.awards.get('b'),200);assert.equal(r.awards.get('c'),100);
});
test('folded chips remain in pots but folded player cannot win',()=>{
 const players=[p('a','A',100,['2♠','3♠'],true),p('b','B',100,['K♠','K♥']),p('c','C',100,['Q♠','Q♥'])];
 const r=settleSidePots(players,['4♣','5♦','7♠','8♥','9♣'],1);
 assert.equal(r.total,300);assert.equal(sumAwards(r.awards),300);assert.equal(r.awards.has('a'),false);assert.equal(r.awards.get('b'),300);
});
test('split pot odd chip follows deterministic dealer-relative order',()=>{
 const players=[p('a','A',5,['2♠','3♠']),p('b','B',5,['2♥','3♥']),p('c','C',5,['4♠','5♠'],true)];
 const board=['A♣','K♦','Q♠','J♥','T♣'];
 const r=settleSidePots(players,board,0);
 assert.equal(r.total,15);assert.equal(sumAwards(r.awards),15);
 assert.equal(r.awards.get('a'),8);assert.equal(r.awards.get('b'),7);
 assert.deepEqual(r.pots[0].winnerIds,['a','b']);
});
test('complex four-player side pots conserve every chip',()=>{
 const players=[p('a','A',75,['A♠','A♥']),p('b','B',150,['K♠','K♥']),p('c','C',240,['Q♠','Q♥']),p('d','D',240,['J♠','J♥'],true)];
 const r=settleSidePots(players,['2♣','3♦','7♠','8♥','9♣'],2);
 assert.deepEqual(r.pots.map(x=>x.amount),[300,225,180]);
 assert.equal(r.total,705);assert.equal(sumAwards(r.awards),705);
});

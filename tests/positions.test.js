import test from'node:test';import assert from'node:assert/strict';import{headsUpPositions,ringPositions,handPositions}from'../worker/positions.js';

function nextFactory(active){return i=>{const pos=active.indexOf(i);return active[(pos+1)%active.length]}}

test('heads-up dealer posts small blind and acts first preflop',()=>{
 const next=nextFactory([0,1]);
 assert.deepEqual(headsUpPositions({dealerIndex:0,nextIndex:next}),{smallBlind:0,bigBlind:1,preflopFirst:0,postflopFirst:1});
});

test('heads-up positions mirror when dealer rotates',()=>{
 const next=nextFactory([0,1]);
 assert.deepEqual(headsUpPositions({dealerIndex:1,nextIndex:next}),{smallBlind:1,bigBlind:0,preflopFirst:1,postflopFirst:0});
});

test('ring table uses player left of dealer as small blind and UTG first preflop',()=>{
 const next=nextFactory([0,1,2,3]);
 assert.deepEqual(ringPositions({dealerIndex:0,nextIndex:next}),{smallBlind:1,bigBlind:2,preflopFirst:3,postflopFirst:1});
});

test('handPositions chooses heads-up semantics only with two active players',()=>{
 const next2=nextFactory([0,1]),next3=nextFactory([0,1,2]);
 assert.equal(handPositions({aliveCount:2,dealerIndex:0,nextIndex:next2}).preflopFirst,0);
 assert.equal(handPositions({aliveCount:3,dealerIndex:0,nextIndex:next3}).preflopFirst,0);
});

test('handPositions rejects fewer than two players',()=>assert.throws(()=>handPositions({aliveCount:1,dealerIndex:0,nextIndex:i=>i}),/At least two/));

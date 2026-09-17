import test from'node:test';import assert from'node:assert/strict';import{headsUpPositions,ringPositions,handPositions,nextHandSeatPositions,nextBigBlindPlayerId,worstBalanceSeat}from'../worker/positions.js';

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

test('next tournament big blind is derived from the next hand, not the hand that just ended',()=>{const players=[{id:'a',seat:1,chips:100},{id:'b',seat:2,chips:100},{id:'c',seat:3,chips:100},{id:'d',seat:4,chips:100}],pos=nextHandSeatPositions({players,dealerPlayerId:'a',dealerSeat:1});assert.equal(pos.dealerPlayerId,'b');assert.equal(pos.smallBlindPlayerId,'c');assert.equal(pos.bigBlindPlayerId,'d');assert.equal(nextBigBlindPlayerId({players,dealerPlayerId:'a',dealerSeat:1}),'d')});

test('next tournament positions preserve button continuity when the prior dealer busted',()=>{const players=[{id:'a',seat:1,chips:100},{id:'c',seat:3,chips:100},{id:'d',seat:4,chips:100}],pos=nextHandSeatPositions({players,dealerPlayerId:'b',dealerSeat:2});assert.equal(pos.dealerPlayerId,'c');assert.equal(pos.smallBlindPlayerId,'d');assert.equal(pos.bigBlindPlayerId,'a')});

test('balancing player takes an immediate big blind seat when one is open',()=>{const players=[{id:'a',seat:1,chips:100},{id:'b',seat:3,chips:100},{id:'c',seat:5,chips:100},{id:'d',seat:7,chips:100}],seat=worstBalanceSeat({players,incomingPlayerId:'x',dealerPlayerId:'a',dealerSeat:1,capacity:8});assert.equal(seat,6);const pos=nextHandSeatPositions({players:[...players,{id:'x',seat,chips:100}],dealerPlayerId:'a',dealerSeat:1});assert.equal(pos.bigBlindPlayerId,'x');assert.notEqual(pos.smallBlindPlayerId,'x')});

test('balancing seat never assigns the incoming player to the small blind',()=>{const players=[{id:'a',seat:1,chips:100},{id:'b',seat:3,chips:100},{id:'c',seat:5,chips:100},{id:'d',seat:6,chips:100},{id:'e',seat:7,chips:100},{id:'f',seat:8,chips:100}],seat=worstBalanceSeat({players,incomingPlayerId:'x',dealerPlayerId:'a',dealerSeat:1,capacity:8}),pos=nextHandSeatPositions({players:[...players,{id:'x',seat,chips:100}],dealerPlayerId:'a',dealerSeat:1});assert.notEqual(pos.smallBlindPlayerId,'x');assert.ok([2,4].includes(seat))});

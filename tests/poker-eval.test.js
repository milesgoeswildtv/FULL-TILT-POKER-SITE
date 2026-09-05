import test from'node:test';
import assert from'node:assert/strict';
import{evaluate,compare}from'../worker/poker-eval.js';

const cat=cards=>evaluate(cards)[0];

test('recognizes every major Holdem hand category',()=>{
  assert.equal(cat(['A♠','K♦','9♣','6♥','3♠']),0);
  assert.equal(cat(['A♠','A♦','9♣','6♥','3♠']),1);
  assert.equal(cat(['A♠','A♦','9♣','9♥','3♠']),2);
  assert.equal(cat(['A♠','A♦','A♣','6♥','3♠']),3);
  assert.equal(cat(['9♠','8♦','7♣','6♥','5♠']),4);
  assert.equal(cat(['A♠','J♠','8♠','5♠','2♠']),5);
  assert.equal(cat(['K♠','K♦','K♣','4♥','4♠']),6);
  assert.equal(cat(['Q♠','Q♦','Q♣','Q♥','3♠']),7);
  assert.equal(cat(['9♠','8♠','7♠','6♠','5♠']),8);
});

test('wheel straight uses ace as low',()=>{
  assert.deepEqual(evaluate(['A♠','2♦','3♣','4♥','5♠','K♣','Q♦']),[4,5]);
});

test('double trips chooses higher trips for full house',()=>{
  assert.deepEqual(evaluate(['K♠','K♦','K♣','8♠','8♦','8♣','2♥']),[6,13,8]);
});

test('board-only hands tie',()=>{
  const a=evaluate(['2♣','3♦','A♠','K♠','Q♠','J♠','T♠']);
  const b=evaluate(['4♣','5♦','A♠','K♠','Q♠','J♠','T♠']);
  assert.equal(compare(a,b),0);
});

test('flush kicker comparison works',()=>{
  const aceHigh=evaluate(['A♠','9♠','7♠','4♠','2♠','K♦','Q♦']);
  const kingHigh=evaluate(['K♥','9♥','7♥','4♥','2♥','A♦','Q♦']);
  assert.ok(compare(aceHigh,kingHigh)>0);
});

test('higher straight beats lower straight',()=>{
  assert.ok(compare(evaluate(['T♠','9♦','8♣','7♥','6♠']),evaluate(['9♠','8♦','7♣','6♥','5♠']))>0);
});

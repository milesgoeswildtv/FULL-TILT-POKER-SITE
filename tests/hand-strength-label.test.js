import test from'node:test';
import assert from'node:assert/strict';
import{handStrengthLabel}from'../worker/poker-eval.js';

test('hand strength labels cover every category',()=>{
 const cases=[
  [['A♠','K♦'],'HIGH CARD'],
  [['A♠','A♦'],'ONE PAIR'],
  [['A♠','A♦','K♣','K♥','2♠'],'TWO PAIR'],
  [['A♠','A♦','A♣','K♥','2♠'],'THREE OF A KIND'],
  [['A♠','K♦','Q♣','J♥','T♠'],'STRAIGHT'],
  [['A♠','J♠','8♠','5♠','2♠'],'FLUSH'],
  [['A♠','A♦','A♣','K♥','K♠'],'FULL HOUSE'],
  [['A♠','A♦','A♣','A♥','K♠'],'FOUR OF A KIND'],
  [['A♠','K♠','Q♠','J♠','T♠'],'STRAIGHT FLUSH']
 ];
 for(const[cards,label]of cases)assert.equal(handStrengthLabel(cards),label,cards.join(' '));
});

test('hand strength label is empty without two visible cards',()=>{
 assert.equal(handStrengthLabel([]),'');
 assert.equal(handStrengthLabel(['A♠']),'');
 assert.equal(handStrengthLabel(null),'');
});

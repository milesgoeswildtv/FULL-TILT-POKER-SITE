import test from'node:test';
import assert from'node:assert/strict';
import{raiseIsOpen,legalBettingState,applyRaiseState}from'../worker/betting.js';

test('single short all-in does not reopen action for a player who already acted',()=>{
 assert.equal(raiseIsOpen(140,100,100),false);
 const legal=legalBettingState({currentBet:140,minRaise:100,playerBet:100,playerChips:900,actedAtBet:100});
 assert.equal(legal.toCall,40);assert.equal(legal.canRaise,false);assert.equal(legal.canAllIn,false);
});

test('cumulative short all-ins reopen once total increase reaches a full raise',()=>{
 assert.equal(raiseIsOpen(160,100,100),false);
 assert.equal(raiseIsOpen(199,100,100),false);
 assert.equal(raiseIsOpen(200,100,100),true);
 const legal=legalBettingState({currentBet:200,minRaise:100,playerBet:100,playerChips:900,actedAtBet:100});
 assert.equal(legal.canRaise,true);assert.equal(legal.canAllIn,true);
});

test('player who has not acted retains raise rights after a short all-in',()=>{
 assert.equal(raiseIsOpen(140,100,undefined),true);
});

test('all-in call remains legal even when raising is not reopened',()=>{
 const legal=legalBettingState({currentBet:140,minRaise:100,playerBet:100,playerChips:25,actedAtBet:100});
 assert.equal(legal.toCall,40);assert.equal(legal.canRaise,false);assert.equal(legal.canAllIn,true);
});

test('non-all-in undersized raise is rejected',()=>{
 assert.throws(()=>applyRaiseState({currentBet:100,minRaise:100,target:150,isAllIn:false}),/Minimum raise/);
});

test('short all-in increases current bet without lowering minimum raise',()=>{
 assert.deepEqual(applyRaiseState({currentBet:100,minRaise:100,target:150,isAllIn:true}),{currentBet:150,minRaise:100,fullRaise:false});
});

test('full raise replaces minimum raise with its actual raise size',()=>{
 assert.deepEqual(applyRaiseState({currentBet:100,minRaise:100,target:250,isAllIn:false}),{currentBet:250,minRaise:150,fullRaise:true});
});

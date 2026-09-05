import test from'node:test';
import assert from'node:assert/strict';
import{DEFAULT_BLINDS,normalizeBlindStructure}from'../worker/tournament.js';
test('uses default blind ladder when input is missing',()=>{assert.deepEqual(normalizeBlindStructure(),DEFAULT_BLINDS)});
test('accepts valid custom blind ladders',()=>{assert.deepEqual(normalizeBlindStructure([[5,10],[10,20],[25,50]]),[[5,10],[10,20],[25,50]])});
test('accepts object-form blind levels',()=>{assert.deepEqual(normalizeBlindStructure([{smallBlind:10,bigBlind:20},{smallBlind:20,bigBlind:40}]),[[10,20],[20,40]])});
test('rejects decreasing blind ladders',()=>{assert.throws(()=>normalizeBlindStructure([[10,20],[5,10]]),/must not decrease/)});
test('falls back when fewer than two valid levels survive validation',()=>{assert.deepEqual(normalizeBlindStructure([[0,0],[10,5]]),DEFAULT_BLINDS)});
test('caps custom structures at 30 levels',()=>{const x=Array.from({length:40},(_,i)=>[i+1,(i+1)*2]);assert.equal(normalizeBlindStructure(x).length,30)});

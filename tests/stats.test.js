import test from'node:test';
import assert from'node:assert/strict';
import{handAwards,knockoutCredits,cleanKnockoutCount}from'../worker/stats.js';
import{settleContributions}from'../worker/settlement.js';

test('biggest pot tracks largest single pot, not total winnings across side pots',()=>{
 const{winnings,biggestPot}=handAwards([{amount:300,winnerIds:['A']},{amount:500,winnerIds:['A']}]);
 assert.equal(winnings.get('A'),800);assert.equal(biggestPot.get('A'),500);
});

test('split pot winnings preserve odd chip distribution while biggest pot is full pot size',()=>{
 const{winnings,biggestPot}=handAwards([{amount:101,winnerIds:['A','B']}]);
 assert.equal(winnings.get('A'),51);assert.equal(winnings.get('B'),50);assert.equal(biggestPot.get('A'),101);assert.equal(biggestPot.get('B'),101);
});

test('uncalled returns are excluded from winnings and biggest-pot statistics',()=>{
 const players=[{id:'A',name:'A',contributed:1000,folded:false,cards:['A♠','A♥']},{id:'B',name:'B',contributed:100,folded:false,cards:['K♠','K♥']}],settlement=settleContributions(players,['2♣','3♦','7♠','8♥','9♣'],0),{winnings,biggestPot}=handAwards(settlement.pots);
 assert.equal(settlement.returns.get('A'),900);assert.equal(winnings.get('A'),200);assert.equal(biggestPot.get('A'),200);assert.equal(winnings.has('B'),false);
});

test('one victim produces exactly one total knockout credit on a split winning pot',()=>{
 const credits=knockoutCredits([{amount:300,participantIds:['V','A','B'],winnerIds:['A','B']}],['V']);
 assert.equal(credits.get('A'),.5);assert.equal(credits.get('B'),.5);assert.equal([...credits.values()].reduce((a,b)=>a+b,0),1);
});

test('multiple victims conserve one total knockout per eliminated player',()=>{
 const pots=[{amount:300,participantIds:['V1','V2','A','B'],winnerIds:['A','B']}];
 const credits=knockoutCredits(pots,['V1','V2']);
 assert.equal(credits.get('A'),1);assert.equal(credits.get('B'),1);assert.equal([...credits.values()].reduce((a,b)=>a+b,0),2);
});

test('victim knockout is attributed from the deepest pot they participated in',()=>{
 const pots=[{amount:300,participantIds:['V','A','B'],winnerIds:['A']},{amount:400,participantIds:['V','B'],winnerIds:['B']}];
 const credits=knockoutCredits(pots,['V']);assert.equal(credits.get('B'),1);assert.equal(credits.has('A'),false);
});

test('fractional knockout totals are rounded for stable display',()=>{assert.equal(cleanKnockoutCount(0.333333),0.33);assert.equal(cleanKnockoutCount(1.99999),2)});

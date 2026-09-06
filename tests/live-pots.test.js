import test from'node:test';
import assert from'node:assert/strict';
import{livePots}from'../worker/live-pots.js';
const p=(id,contributed,folded=false)=>({id,contributed,folded});
test('single matched pot stays one pot',()=>{assert.deepEqual(livePots([p('a',100),p('b',100),p('c',100)]),[{amount:300,eligibleCount:3,participantCount:3}])});
test('unequal all-ins create main and side pots',()=>{assert.deepEqual(livePots([p('a',50),p('b',100),p('c',200)]),[{amount:150,eligibleCount:3,participantCount:3},{amount:100,eligibleCount:2,participantCount:2},{amount:100,eligibleCount:1,participantCount:1}])});
test('folded dead money remains in amount but not eligibility',()=>{assert.deepEqual(livePots([p('a',100,true),p('b',100),p('c',50)]),[{amount:150,eligibleCount:2,participantCount:3},{amount:100,eligibleCount:1,participantCount:2}])});
test('zero contributions are ignored',()=>{assert.deepEqual(livePots([p('a',0),p('b',25),p('c',25)]),[{amount:50,eligibleCount:2,participantCount:2}])});
test('nine-way staggered all-ins conserve all contributions',()=>{const players=[10,20,30,40,50,60,70,80,90].map((v,i)=>p(String(i),v,i===4));const pots=livePots(players);assert.equal(pots.reduce((s,x)=>s+x.amount,0),450);assert.equal(pots.length,9);assert.equal(pots[0].amount,90);assert.equal(pots.at(-1).amount,10);assert.equal(pots[0].eligibleCount,8)})
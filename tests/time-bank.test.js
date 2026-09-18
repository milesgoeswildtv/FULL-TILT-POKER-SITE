import test from'node:test';
import assert from'node:assert/strict';
import{TIME_BANK_INITIAL_MS,TIME_BANK_CHUNK_MS,normalizeTimeBankMs,spendTimeBank}from'../worker/time-bank.js';

test('time bank defaults to sixty seconds and spends fifteen-second chunks',()=>{
 assert.equal(TIME_BANK_INITIAL_MS,60000);
 assert.equal(TIME_BANK_CHUNK_MS,15000);
 assert.deepEqual(spendTimeBank(undefined),{spent:15000,remaining:45000});
 assert.deepEqual(spendTimeBank(45000),{spent:15000,remaining:30000});
 assert.deepEqual(spendTimeBank(7000),{spent:7000,remaining:0});
 assert.deepEqual(spendTimeBank(0),{spent:0,remaining:0});
});

test('time bank normalization preserves zero and repairs invalid legacy values',()=>{
 assert.equal(normalizeTimeBankMs(0),0);
 assert.equal(normalizeTimeBankMs(30000),30000);
 assert.equal(normalizeTimeBankMs(undefined),60000);
 assert.equal(normalizeTimeBankMs(-1),60000);
 assert.equal(normalizeTimeBankMs('bad'),60000);
});

import test from'node:test';
import assert from'node:assert/strict';
import{mttSyncRetryDelay}from'../worker/app.js';

test('MTT coordinator failures use bounded exponential retry backoff',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,20].map(mttSyncRetryDelay),[2000,4000,8000,16000,30000,30000,30000,30000]);
});

test('MTT retry delay safely normalizes missing or invalid failure counts',()=>{
 assert.equal(mttSyncRetryDelay(),2000);
 assert.equal(mttSyncRetryDelay(0),2000);
 assert.equal(mttSyncRetryDelay(-5),2000);
 assert.equal(mttSyncRetryDelay('3'),8000);
});

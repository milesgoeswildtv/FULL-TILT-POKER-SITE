import test from'node:test';
import assert from'node:assert/strict';
import{frozenTurnRemaining,resumeDeadline,resumeTurnDeadline,resumePhaseDeadline,shiftedLevelStart,showdownExpired,blindAdvance}from'../worker/lifecycle.js';

const LEVELS=[[10,20],[20,40],[30,60],[50,100]];

test('pause freezes only the remaining turn time',()=>{
 assert.equal(frozenTurnRemaining(15000,10000),5000);
 assert.equal(frozenTurnRemaining(null,10000),null);
 assert.equal(frozenTurnRemaining(9000,10000),0);
});

test('generic resume deadline clamps negative values and honors configured grace',()=>{
 assert.equal(resumeDeadline(5000,10000,250),15000);
 assert.equal(resumeDeadline(-50,10000,250),10250);
 assert.equal(resumeDeadline(null,10000,250),null);
});

test('turn resume restores deadline with a one-second floor',()=>{
 assert.equal(resumeTurnDeadline(5000,10000),15000);
 assert.equal(resumeTurnDeadline(0,10000),11000);
 assert.equal(resumeTurnDeadline(null,10000),null);
});

test('showdown phase resume receives a short nonzero transition floor',()=>{
 assert.equal(resumePhaseDeadline(5000,10000),15000);
 assert.equal(resumePhaseDeadline(0,10000),10250);
 assert.equal(resumePhaseDeadline(null,10000),null);
});

test('blind clock shifts by the exact pause duration',()=>{
 assert.equal(shiftedLevelStart(1000,5000,9000),5000);
 assert.equal(shiftedLevelStart(null,5000,9000),null);
});

test('showdown only expires after its deadline',()=>{
 assert.equal(showdownExpired({street:'showdown',phaseDeadline:15000},14999),false);
 assert.equal(showdownExpired({street:'showdown',phaseDeadline:15000},15000),true);
 assert.equal(showdownExpired({street:'river',phaseDeadline:15000},16000),false);
});

test('blind advancement can skip multiple elapsed levels deterministically',()=>{
 const x=blindAdvance({started:true,paused:false,levelStartedAt:1000,blindMinutes:1,blindLevel:0,levels:LEVELS},181000);
 assert.deepEqual(x,{changed:true,blindLevel:3,levelStartedAt:181000,smallBlind:50,bigBlind:100});
});

test('blind advancement is frozen while paused',()=>{
 assert.equal(blindAdvance({started:true,paused:true,levelStartedAt:1000,blindMinutes:1,blindLevel:0,levels:LEVELS},181000),null);
});

test('blind advancement reports no visible change once structure is capped',()=>{
 const x=blindAdvance({started:true,paused:false,levelStartedAt:1000,blindMinutes:1,blindLevel:3,levels:LEVELS},181000);
 assert.equal(x.changed,false);assert.equal(x.blindLevel,3);
});

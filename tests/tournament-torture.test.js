import test from'node:test';
import assert from'node:assert/strict';
import{blindAdvance,frozenTurnRemaining,resumeTurnDeadline,shiftedLevelStart,showdownExpired}from'../worker/lifecycle.js';

const LEVELS=[[10,20],[20,40],[40,80],[80,160]];

test('blind clock catches up multiple missed levels without overshooting the ladder',()=>{
 const start=1_000_000,duration=5*60_000,now=start+duration*10+17_000;
 const next=blindAdvance({started:true,paused:false,levelStartedAt:start,blindMinutes:5,blindLevel:0,levels:LEVELS},now);
 assert.equal(next.blindLevel,LEVELS.length-1);
 assert.equal(next.smallBlind,80);
 assert.equal(next.bigBlind,160);
 assert.equal(next.changed,true);
 assert.equal(next.levelStartedAt,start+duration*10);
});

test('paused blind clock never advances even after a huge wall-clock jump',()=>{
 const next=blindAdvance({started:true,paused:true,levelStartedAt:1_000,blindMinutes:5,blindLevel:1,levels:LEVELS},99_000_000);
 assert.equal(next,null);
});

test('pause and resume preserve the action clock instead of gifting a fresh turn',()=>{
 const pauseAt=10_000,deadline=22_500,resumeAt=70_000;
 const remaining=frozenTurnRemaining(deadline,pauseAt);
 assert.equal(remaining,12_500);
 assert.equal(resumeTurnDeadline(remaining,resumeAt),82_500);
});

test('resume gives at least one second when pause happened exactly at timeout',()=>{
 const remaining=frozenTurnRemaining(10_000,10_000);
 assert.equal(remaining,0);
 assert.equal(resumeTurnDeadline(remaining,50_000),51_000);
});

test('blind level start shifts by exactly the paused duration',()=>{
 assert.equal(shiftedLevelStart(5_000,20_000,50_000),35_000);
});

test('showdown expiry is edge exact and never fires for another street',()=>{
 assert.equal(showdownExpired({street:'showdown',phaseDeadline:10_000},9_999),false);
 assert.equal(showdownExpired({street:'showdown',phaseDeadline:10_000},10_000),true);
 assert.equal(showdownExpired({street:'river',phaseDeadline:10_000},20_000),false);
});

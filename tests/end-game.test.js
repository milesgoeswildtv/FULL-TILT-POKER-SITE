import test from'node:test';
import assert from'node:assert/strict';
import{endTournamentState}from'../worker/end-game.js';

test('host end produces an explicit terminal state',()=>{const d={started:true,paused:true,pausedAt:50,turnRemainingMs:9000,turnDeadline:100,phaseDeadline:200,street:'showdown',message:'x'};endTournamentState(d,1234);assert.equal(d.started,false);assert.equal(d.paused,false);assert.equal(d.street,'finished');assert.equal(d.endedByHost,true);assert.equal(d.endedAt,1234);assert.equal(d.turnDeadline,null);assert.equal(d.phaseDeadline,null);assert.equal(d.turnRemainingMs,null);assert.equal(d.message,'Tournament ended by host.')});

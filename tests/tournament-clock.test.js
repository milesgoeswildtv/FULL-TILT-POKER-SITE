import test from'node:test';
import assert from'node:assert/strict';
import{createTournamentClock,tournamentClockState,blindsForNewHand,pauseTournamentClock,resumeTournamentClock}from'../worker/tournament-clock.js';
const structure=[[25,50],[50,100],[75,150],[100,200]];

test('all tables read the same tournament blind level at the same instant',()=>{
 const clock=createTournamentClock({blindStructure:structure,levelDurationMs:150000,now:1000});
 const a=tournamentClockState(clock,151000),b=tournamentClockState(clock,151000),c=tournamentClockState(clock,151000);
 assert.deepEqual(a,b);assert.deepEqual(b,c);assert.equal(a.blindLevel,1);assert.equal(a.smallBlind,50);assert.equal(a.bigBlind,100);
});

test('blind rollover does not alter an already-started hand snapshot',()=>{
 const clock=createTournamentClock({blindStructure:structure,levelDurationMs:150000,now:1000});
 const liveHand=blindsForNewHand(clock,150999);
 assert.deepEqual(liveHand,{blindLevel:0,smallBlind:25,bigBlind:50,ante:0});
 const tournamentNow=tournamentClockState(clock,151001);
 assert.equal(tournamentNow.blindLevel,1);
 assert.deepEqual(liveHand,{blindLevel:0,smallBlind:25,bigBlind:50,ante:0});
 const nextHand=blindsForNewHand(clock,151001);
 assert.deepEqual(nextHand,{blindLevel:1,smallBlind:50,bigBlind:100,ante:0});
});

test('pause and resume freezes one global clock for every table',()=>{
 const clock=createTournamentClock({blindStructure:structure,levelDurationMs:150000,now:1000});
 pauseTournamentClock(clock,61000);
 assert.equal(tournamentClockState(clock,999999).remainingMs,90000);
 resumeTournamentClock(clock,121000);
 assert.equal(tournamentClockState(clock,181000).blindLevel,0);
 assert.equal(tournamentClockState(clock,211000).blindLevel,1);
});

test('a 2:30 clock advances every 150 seconds regardless of hand speed',()=>{
 const clock=createTournamentClock({blindStructure:structure,levelDurationMs:150000,now:0});
 assert.equal(tournamentClockState(clock,149999).blindLevel,0);
 assert.equal(tournamentClockState(clock,150000).blindLevel,1);
 assert.equal(tournamentClockState(clock,300000).blindLevel,2);
});

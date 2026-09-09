export function normalizeLevelDurationMs(value,fallback=600000){
 const n=Math.trunc(Number(value));
 return Number.isFinite(n)&&n>=1000?n:fallback;
}

export function createTournamentClock({blindStructure,levelDurationMs,now=Date.now()}={}){
 if(!Array.isArray(blindStructure)||!blindStructure.length)throw Error('Blind structure required.');
 const duration=normalizeLevelDurationMs(levelDurationMs);
 return{blindLevel:0,levelStartedAt:now,levelDurationMs:duration,paused:false,pausedAt:null,totalPausedMs:0,blindStructure:blindStructure.map(level=>[...level])};
}

export function effectiveNow(clock,now=Date.now()){
 return clock.paused?Number(clock.pausedAt||now):now;
}

export function levelAt(clock,now=Date.now()){
 const elapsed=Math.max(0,effectiveNow(clock,now)-Number(clock.levelStartedAt||0)-Number(clock.totalPausedMs||0));
 const duration=normalizeLevelDurationMs(clock.levelDurationMs);
 return Math.min(clock.blindStructure.length-1,Math.floor(elapsed/duration));
}

export function tournamentClockState(clock,now=Date.now()){
 const level=levelAt(clock,now),duration=normalizeLevelDurationMs(clock.levelDurationMs),elapsed=Math.max(0,effectiveNow(clock,now)-Number(clock.levelStartedAt||0)-Number(clock.totalPausedMs||0)),intoLevel=elapsed%duration,remainingMs=level>=clock.blindStructure.length-1?Math.max(0,duration-intoLevel):duration-intoLevel,[smallBlind,bigBlind,ante=0]=clock.blindStructure[level];
 return{blindLevel:level,smallBlind,bigBlind,ante,remainingMs,paused:!!clock.paused,levelDurationMs:duration};
}

export function pauseTournamentClock(clock,now=Date.now()){
 if(clock.paused)return clock;
 clock.paused=true;clock.pausedAt=now;return clock;
}

export function resumeTournamentClock(clock,now=Date.now()){
 if(!clock.paused)return clock;
 clock.totalPausedMs=Number(clock.totalPausedMs||0)+Math.max(0,now-Number(clock.pausedAt||now));
 clock.paused=false;clock.pausedAt=null;return clock;
}

// A hand snapshots the tournament level when it begins. A clock rollover never mutates a live hand.
export function blindsForNewHand(clock,now=Date.now()){
 const state=tournamentClockState(clock,now);
 return{blindLevel:state.blindLevel,smallBlind:state.smallBlind,bigBlind:state.bigBlind,ante:state.ante};
}

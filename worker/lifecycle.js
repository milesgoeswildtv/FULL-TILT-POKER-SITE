export function frozenTurnRemaining(deadline,now=Date.now()){return deadline?Math.max(0,deadline-now):null}
export function resumeTurnDeadline(remainingMs,now=Date.now()){return remainingMs==null?null:now+Math.max(1000,remainingMs)}
export function shiftedLevelStart(levelStartedAt,pausedAt,now=Date.now()){return levelStartedAt&&pausedAt?levelStartedAt+(now-pausedAt):levelStartedAt}
export function showdownExpired({street,phaseDeadline},now=Date.now()){return street==='showdown'&&!!phaseDeadline&&now>=phaseDeadline}
export function blindAdvance({started,paused,levelStartedAt,blindMinutes,blindLevel,levels},now=Date.now()){
 if(!started||paused||!levelStartedAt)return null;
 const duration=blindMinutes*60000,passed=now-levelStartedAt;if(passed<duration)return null;
 const jumps=Math.floor(passed/duration),nextLevel=Math.min(levels.length-1,blindLevel+jumps);
 return{changed:nextLevel!==blindLevel,blindLevel:nextLevel,levelStartedAt:levelStartedAt+jumps*duration,smallBlind:levels[nextLevel][0],bigBlind:levels[nextLevel][1]};
}

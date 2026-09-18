const MINUTE=60000;
export const DEFAULT_BREAK_EVERY_MS=55*MINUTE;
export const DEFAULT_BREAK_DURATION_MS=5*MINUTE;

function positiveMs(value,fallback,min=1000,max=6*60*60*1000){
 const n=Math.trunc(Number(value));
 return Number.isFinite(n)&&n>=min?Math.min(max,n):fallback;
}

export function normalizeBreakSchedule(input={}){
 const enabled=input.breaksEnabled!==false;
 const everyFromMinutes=Number(input.breakEveryMinutes)*MINUTE;
 const durationFromMinutes=Number(input.breakDurationMinutes)*MINUTE;
 const everyMs=positiveMs(input.breakEveryMs,positiveMs(everyFromMinutes,DEFAULT_BREAK_EVERY_MS,5*MINUTE),5*MINUTE);
 const durationMs=positiveMs(input.breakDurationMs,positiveMs(durationFromMinutes,DEFAULT_BREAK_DURATION_MS,MINUTE,30*MINUTE),MINUTE,30*MINUTE);
 return{enabled,everyMs,durationMs,nextDueAt:null,sequence:0};
}

export function scheduleFirstBreak(schedule,startedAt){
 if(!schedule?.enabled)return schedule;
 schedule.nextDueAt=Number(startedAt)+Number(schedule.everyMs);
 return schedule;
}

export function scheduledBreakDue(schedule,now=Date.now()){
 return!!(schedule?.enabled&&Number(schedule.nextDueAt)>0&&Number(now)>=Number(schedule.nextDueAt));
}

export function shiftScheduledBreak(schedule,deltaMs){
 if(!schedule?.enabled||!Number(schedule.nextDueAt))return schedule;
 schedule.nextDueAt+=Math.max(0,Math.trunc(Number(deltaMs)||0));
 return schedule;
}

export function nextScheduledBreak(schedule,resumedAt){
 if(!schedule?.enabled)return schedule;
 schedule.sequence=Math.max(0,Math.trunc(Number(schedule.sequence)||0))+1;
 schedule.nextDueAt=Number(resumedAt)+Number(schedule.everyMs);
 return schedule;
}

export function breakCountdown(activeBreak,now=Date.now()){
 if(!activeBreak?.endsAt)return 0;
 return Math.max(0,Number(activeBreak.endsAt)-Number(now));
}

import test from'node:test';
import assert from'node:assert/strict';
import{createTournamentClock,tournamentClockState}from'../worker/tournament-clock.js';
import{normalizeBreakSchedule,scheduleFirstBreak,scheduledBreakDue,shiftScheduledBreak,nextScheduledBreak,breakCountdown}from'../worker/tournament-breaks.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';

test('scheduled break defaults are 5 minutes every 55 minutes and can be disabled',()=>{
 const enabled=normalizeBreakSchedule({});
 assert.equal(enabled.enabled,true);
 assert.equal(enabled.everyMs,55*60000);
 assert.equal(enabled.durationMs,5*60000);
 const disabled=normalizeBreakSchedule({breaksEnabled:false});
 assert.equal(disabled.enabled,false);
});

test('break schedule starts from tournament start and shifts with manual pause time',()=>{
 const s=normalizeBreakSchedule({breakEveryMinutes:55,breakDurationMinutes:5});
 scheduleFirstBreak(s,1000);
 assert.equal(s.nextDueAt,1000+55*60000);
 assert.equal(scheduledBreakDue(s,s.nextDueAt-1),false);
 assert.equal(scheduledBreakDue(s,s.nextDueAt),true);
 shiftScheduledBreak(s,30000);
 assert.equal(s.nextDueAt,1000+55*60000+30000);
 nextScheduledBreak(s,999999);
 assert.equal(s.sequence,1);
 assert.equal(s.nextDueAt,999999+55*60000);
 assert.equal(breakCountdown({endsAt:20000},15000),5000);
});

function breakHarness(){
 const controls=[],alarms=[];
 const tableStub={fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/mtt/control'){const b=await req.json();controls.push({type:b.type,tableNumber:b.snapshot?.tableNumber,status:b.snapshot?.status});return Response.json({ok:true})}return Response.json({error:'unexpected'},{status:404})}};
 const state={storage:{put:async()=>{},setAlarm:at=>{alarms.push(at)}}},env={TABLES:{idFromName:x=>x,get:()=>tableStub}},c=new TournamentCoordinator(state,env);
 const players=[
  {id:'p1',token:'t1',name:'One',chips:2500,eliminated:false,tableNumber:1,seat:1,reportOwnerTable:1,ownershipGeneration:1},
  {id:'p2',token:'t2',name:'Two',chips:2500,eliminated:false,tableNumber:1,seat:2,reportOwnerTable:1,ownershipGeneration:1},
  {id:'p3',token:'t3',name:'Three',chips:2500,eliminated:false,tableNumber:2,seat:1,reportOwnerTable:2,ownershipGeneration:1},
  {id:'p4',token:'t4',name:'Four',chips:2500,eliminated:false,tableNumber:2,seat:2,reportOwnerTable:2,ownershipGeneration:1}
 ].map(p=>({...p,finishPlace:null,moveCount:0,handStartChips:2500,stats:{},cosmetic:'default',sittingOut:false,timeBankMs:60000,pendingMoveId:null}));
 const tables=[1,2].map(n=>({tableNumber:n,tableKey:`BRK-T${n}`,capacity:8,playerIds:n===1?['p1','p2']:['p3','p4'],status:'running',handNumber:1,reportGeneration:1,lastBoundarySequence:1,lastBoundaryFingerprint:null,lastReportAt:null,nextBigBlindPlayerId:null,breakBoundaryAt:0,provisioned:true}));
 c.data={code:'BRK001',status:'running',startingChips:2500,players,tables,pendingMoves:[],eliminationLedger:[],telegramNotifications:[],clock:createTournamentClock({blindStructure:[[50,100],[75,150]],levelDurationMs:600000,now:1000}),breakSchedule:{enabled:true,everyMs:300000,durationMs:60000,nextDueAt:301000,sequence:0},scheduledBreak:null,lastScheduledBreak:null};
 return{c,controls,alarms};
}

test('scheduled break waits for every open table boundary, then pauses and resumes together',async()=>{
 const{c,controls,alarms}=breakHarness();
 c.observeBreakBoundary(1,301100);
 assert.equal(await c.maybeStartScheduledBreak(301100),false);
 assert.equal(c.data.status,'break-pending');
 assert.equal(c.data.clock.paused,true);
 assert.equal(c.data.scheduledBreak.dueAt,301000);
 assert.equal(controls.length,0);
 const frozen=tournamentClockState(c.data.clock,301100).remainingMs;
 assert.equal(tournamentClockState(c.data.clock,350000).remainingMs,frozen);

 c.observeBreakBoundary(2,302000);
 assert.equal(await c.maybeStartScheduledBreak(302000),true);
 assert.equal(c.data.status,'break');
 assert.equal(c.data.scheduledBreak.startedAt,302000);
 assert.equal(c.data.scheduledBreak.endsAt,362000);
 assert.deepEqual(controls.map(x=>x.type),['pause','pause']);
 assert.ok(alarms.includes(362000));

 assert.equal(await c.finishScheduledBreak(361999),false);
 assert.equal(c.data.status,'break');
 assert.equal(await c.finishScheduledBreak(362000),true);
 assert.equal(c.data.status,'running');
 assert.equal(c.data.clock.paused,false);
 assert.equal(c.data.scheduledBreak,null);
 assert.equal(c.data.lastScheduledBreak.sequence,1);
 assert.equal(c.data.breakSchedule.sequence,1);
 assert.equal(c.data.breakSchedule.nextDueAt,662000);
 assert.deepEqual(controls.map(x=>x.type),['pause','pause','resume','resume']);
});

test('coordinator alarm picks the earlier of Telegram retry and break end',()=>{
 const{c,alarms}=breakHarness();
 c.data.status='break';c.data.scheduledBreak={endsAt:5000};c.data.telegramNotifications=[{status:'pending',nextAttemptAt:3000}];
 c.scheduleCoordinatorAlarm(1000);
 assert.equal(alarms.at(-1),3000);
 c.data.telegramNotifications[0].nextAttemptAt=9000;
 c.scheduleCoordinatorAlarm(1000);
 assert.equal(alarms.at(-1),5000);
});

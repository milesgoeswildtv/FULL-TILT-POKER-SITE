import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY,MTT_MAX_TABLES}from'./mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand,pauseTournamentClock,resumeTournamentClock}from'./tournament-clock.js';
import{tournamentTableKey,childTablePayload}from'./mtt-provision.js';
import{nextTournamentMove,planTableBreak,movePlayer}from'./mtt-moves.js';
import{validateBoundaryHeader,validateCompleteRoster,validateNextBigBlind,assertBoundaryChipConservation,eliminationEvent,recomputeEliminationPlaces}from'./mtt-protocol.js';
import{sendTelegramTournamentNotification}from'./telegram-notifications.js';

const KEY='tournament',COSMETICS=new Set(['default','constellation','deadMansHand','regalia']);
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function cleanCosmetic(v){return COSMETICS.has(String(v||''))?String(v):'default'}
function playerId(i){return`p${String(i+1).padStart(2,'0')}`}
function sessionToken(){return crypto.randomUUID().replace(/-/g,'')}
function nonNegativeInt(v){return Math.max(0,Math.trunc(Number(v)||0))}
function positiveInt(v,fallback=1){const n=Math.trunc(Number(v));return Number.isInteger(n)&&n>0?n:fallback}
function validSeat(v){return v!=null&&Number.isInteger(Number(v))&&Number(v)>=1}
function cleanStats(stats={}){return{handsPlayed:nonNegativeInt(stats.handsPlayed),handsWon:nonNegativeInt(stats.handsWon),vpipHands:nonNegativeInt(stats.vpipHands),pfrHands:nonNegativeInt(stats.pfrHands),biggestPotWon:nonNegativeInt(stats.biggestPotWon),knockouts:Math.max(0,Number(stats.knockouts)||0),chipsWon:nonNegativeInt(stats.chipsWon)}}
function activeField(d){return d.players.filter(p=>!p.eliminated&&p.chips>0)}
function publicState(d,now=Date.now()){
 const clock=d.clock?tournamentClockState(d.clock,now):null,pendingMoves=(d.pendingMoves||[]).map(({playerToken,...move})=>move),controlTransition=d.status==='starting'?'start':d.transition?.type||null;
 const players=d.players.map(({token,accountId,reportOwnerTable,pendingMoveId,ownershipGeneration,...p})=>p),tables=d.tables.map(({lastBoundaryFingerprint,...table})=>table);
 return{code:d.code,status:d.status,controlTransition,registrationOpen:d.status==='lobby'&&!controlTransition&&!d.tables?.some(t=>t.provisioned),startingChips:d.startingChips,maxPlayers:MTT_MAX_PLAYERS,tableCapacity:MTT_TABLE_CAPACITY,maxTables:MTT_MAX_TABLES,clock,fieldRemaining:activeField(d).length,players,tables,pendingMoves,createdAt:d.createdAt,startedAt:d.startedAt||null,finishedAt:d.finishedAt||null,endedAt:d.endedAt||null,endedByHost:!!d.endedByHost};
}
async function body(response){const b=await response.json().catch(()=>({}));if(!response.ok)throw Error(b.error||`Child table returned ${response.status}.`);return b}

export class TournamentCoordinator{
 constructor(state,env){this.state=state;this.env=env;this.data=null;this.transitionInFlight=null}
 async load(){
  if(this.data)return;this.data=await this.state.storage.get(KEY)||null;if(!this.data)return;
  const d=this.data;d.pendingMoves??=[];d.eliminationLedger??=[];d.telegramNotifications??=[];d.endedAt??=null;d.endedByHost=!!d.endedByHost;d.resultsSyncedAt??=null;if(d.status==='starting')d.transition={type:'start',...(d.transition||{})};else d.transition=null;
  for(const table of d.tables||[]){table.reportGeneration=positiveInt(table.reportGeneration);table.lastBoundarySequence=nonNegativeInt(table.lastBoundarySequence??table.handNumber);table.lastBoundaryFingerprint??=null;table.handNumber=nonNegativeInt(table.handNumber);table.nextBigBlindPlayerId??=null}
  for(const p of d.players||[]){p.stats={...cleanStats(),...cleanStats(p.stats)};p.host=!!p.host;p.accountId=String(p.accountId||'')||null;p.cosmetic=cleanCosmetic(p.cosmetic);p.ownershipGeneration=positiveInt(p.ownershipGeneration);if(p.reportOwnerTable===undefined)p.reportOwnerTable=p.eliminated?null:p.tableNumber;p.pendingMoveId??=null}
  for(const move of d.pendingMoves.filter(m=>!m.acknowledged)){const p=this.player(move.playerId);if(!p)continue;move.fromOwnershipGeneration=positiveInt(move.fromOwnershipGeneration,p.ownershipGeneration);move.toOwnershipGeneration=positiveInt(move.toOwnershipGeneration,p.ownershipGeneration);p.ownershipGeneration=move.toOwnershipGeneration;p.reportOwnerTable=null;p.pendingMoveId=move.id;if(move.toSeat==null)p.seat=null}
  if(d.players?.length&&!d.players.some(p=>p.host))d.players[0].host=true;recomputeEliminationPlaces(d)
 }
 async save(){await this.state.storage.put(KEY,this.data)}
 assertTournamentChipSupply(){const d=this.data,expected=nonNegativeInt(d.startingChips)*d.players.length,actual=d.players.reduce((sum,p)=>sum+nonNegativeInt(p.chips),0);if(actual!==expected)throw Error(`Tournament chip invariant failed: expected ${expected}, found ${actual}.`);return actual}
 async syncTournamentResults(){if(!this.data||this.data.status!=='finished'||this.data.resultsSyncedAt||!this.env?.ACCOUNTS)return true;const linked=this.data.players.filter(p=>p.accountId&&Number.isInteger(p.finishPlace));if(!linked.length){this.data.resultsSyncedAt=Date.now();await this.save();return true}const fieldSize=this.data.players.length,results=await Promise.allSettled(linked.map(async p=>{const stub=this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName(p.accountId)),r=await stub.fetch(new Request('https://account.internal/stats/tournament',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tournamentCode:this.data.code,finishPlace:p.finishPlace,fieldSize})}));if(!r.ok){const b=await r.json().catch(()=>({}));throw Error(b.error||`Tournament account sync failed with ${r.status}.`)}}));if(results.every(r=>r.status==='fulfilled')){this.data.resultsSyncedAt=Date.now();await this.save();return true}return false}
 table(tableNumber){return this.data?.tables.find(t=>t.tableNumber===Number(tableNumber))||null}
 player(id){return this.data?.players.find(p=>p.id===id)||null}
 sessionPlayer(token){return this.data?.players.find(p=>p.token===String(token||''))||null}
 reportOwners(tableNumber){return(this.data?.players||[]).filter(p=>!p.eliminated&&p.chips>0&&Number(p.reportOwnerTable)===Number(tableNumber))}
 busy(type){if(!this.transitionInFlight)return null;return json({error:`Tournament ${this.transitionInFlight} is already in progress.`,requested:type,state:publicState(this.data)},409)}
 sessionState(token,now=Date.now()){
  const p=this.sessionPlayer(token);if(!p)throw Error('Invalid tournament session.');const table=this.table(p.tableNumber);
  return{tournament:publicState(this.data,now),session:{playerId:p.id,name:p.name,host:!!p.host,chips:p.chips,eliminated:!!p.eliminated,finishPlace:p.finishPlace,tableNumber:p.tableNumber,seat:validSeat(p.seat)?Number(p.seat):null,tableKey:table?.tableKey||null,tableStatus:table?.status||null,provisioned:!!table?.provisioned}};
 }
 rebuildLobbySeating(){
  if(this.data.status!=='lobby')throw Error('Tournament seating is locked.');if(this.data.tables?.some(t=>t.provisioned))throw Error('Tournament tables are already provisioned.');
  const seating=initialAssignments(this.data.players);for(const p of this.data.players){p.tableNumber=null;p.seat=null;p.reportOwnerTable=null;p.pendingMoveId=null;p.ownershipGeneration=positiveInt(p.ownershipGeneration)}for(const a of seating.assignments){const p=this.player(a.playerId);p.tableNumber=a.tableNumber;p.seat=a.seat;p.reportOwnerTable=a.tableNumber}
  this.data.tables=seating.tables.map(t=>({tableNumber:t.tableNumber,tableKey:tournamentTableKey(this.data.code,t.tableNumber),capacity:t.capacity,playerIds:t.players.map(p=>p.playerId),status:'waiting',handNumber:0,reportGeneration:1,lastBoundarySequence:0,lastBoundaryFingerprint:null,lastReportAt:null,nextBigBlindPlayerId:null,provisioned:false,provisionedAt:null,provisionError:null}));return this.data.tables;
 }
 joinLobby(name,meta={}){
  if(this.data.status==='starting'||this.data.transition?.type==='start')throw Error('Tournament start is in progress. Registration is locked.');if(this.data.status!=='lobby')throw Error('Tournament already started.');if(this.data.tables?.some(t=>t.provisioned))throw Error('Tournament seating is locked for start.');if(this.data.players.length>=MTT_MAX_PLAYERS)throw Error(`Tournament is capped at ${MTT_MAX_PLAYERS} players.`);
  const clean=cleanName(name);if(!clean)throw Error('Display name required.');if(this.data.players.some(p=>p.name.toLowerCase()===clean.toLowerCase()))throw Error('That display name is already registered.');
  const p={id:playerId(this.data.players.length),token:sessionToken(),accountId:String(meta.accountId||'')||null,name:clean,chips:this.data.startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:this.data.startingChips,stats:cleanStats(),cosmetic:cleanCosmetic(meta.cosmetic),host:false,ownershipGeneration:1,reportOwnerTable:null,pendingMoveId:null};this.data.players.push(p);this.rebuildLobbySeating();return p;
 }
 tableSnapshot(tableNumber,now=Date.now()){
  const table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  const players=table.playerIds.map(id=>this.player(id)).filter(p=>p&&!p.eliminated&&p.chips>0).sort((a,b)=>(validSeat(a.seat)?Number(a.seat):99)-(validSeat(b.seat)?Number(b.seat):99)).map(p=>({id:p.id,token:p.token,accountId:p.accountId||null,name:p.name,chips:p.chips,eliminated:false,finishPlace:p.finishPlace,moveCount:p.moveCount,tableNumber:p.tableNumber,seat:validSeat(p.seat)?Number(p.seat):null,ownershipGeneration:positiveInt(p.ownershipGeneration),stats:cleanStats(p.stats),cosmetic:cleanCosmetic(p.cosmetic)}));
  const moves=(this.data.pendingMoves||[]).filter(m=>!m.acknowledged&&(m.fromTable===table.tableNumber||m.toTable===table.tableNumber)).map(m=>({...m}));
  return{tournamentCode:this.data.code,tableNumber:table.tableNumber,tableKey:table.tableKey,capacity:table.capacity,reportGeneration:positiveInt(table.reportGeneration),status:this.data.status,tableStatus:table.status,fieldRemaining:activeField(this.data).length,players,moves,clock:tournamentClockState(this.data.clock,now),handBlinds:blindsForNewHand(this.data.clock,now)};
 }
 reportTable(tableNumber,rawReport){
  const table=this.table(tableNumber),checked=validateBoundaryHeader(table,rawReport);if(checked.kind==='duplicate')return{kind:'duplicate',newlyBusted:[]};
  const report=checked.report,expected=this.reportOwners(tableNumber);validateCompleteRoster(expected,report.players);validateNextBigBlind(report);assertBoundaryChipConservation(expected,report.players);
  const newlyBusted=[];for(const row of report.players){const p=this.player(row.id);if(!p)throw Error('Tournament report player is missing from coordinator state.');const wasAlive=!p.eliminated&&p.chips>0;p.chips=row.chips;p.stats=cleanStats(row.stats||p.stats);p.cosmetic=cleanCosmetic(row.cosmetic||p.cosmetic);p.handStartChips=row.handStartChips;if(wasAlive&&row.chips===0){p.eliminated=true;p.reportOwnerTable=null;p.pendingMoveId=null;newlyBusted.push(p);const event=eliminationEvent({tableNumber,report,player:p});if(!this.data.eliminationLedger.some(e=>e.id===event.id))this.data.eliminationLedger.push(event)}}
  table.lastReportAt=Date.now();table.handNumber=report.handNumber;table.lastBoundarySequence=report.boundarySequence;table.lastBoundaryFingerprint=checked.fingerprint;table.nextBigBlindPlayerId=report.nextBigBlindPlayerId;if(table.status!=='closed')table.status=report.status||table.status||'running';
  const survivors=recomputeEliminationPlaces(this.data);this.assertTournamentChipSupply();if(survivors.length===1){this.data.status='finished';this.data.finishedAt??=report.completedAt||Date.now();this.data.endedByHost=false}
  return{kind:'new',newlyBusted:newlyBusted.map(p=>p.id)};
 }
 bumpReportGeneration(tableNumber){const table=this.table(tableNumber);if(table)table.reportGeneration=positiveInt(table.reportGeneration)+1}
 queueTelegramNotification(event){const d=this.data;if(!d)return false;d.telegramNotifications??=[];const id=String(event?.id||'');if(!id||d.telegramNotifications.some(x=>x.id===id))return false;d.telegramNotifications.push({...event,id,status:'pending',attempts:0,createdAt:Date.now(),nextAttemptAt:Date.now()});if(d.telegramNotifications.length>500)d.telegramNotifications=d.telegramNotifications.slice(-500);return true}
 scheduleTelegramNotifications(){const q=(this.data?.telegramNotifications||[]).filter(x=>x.status==='pending');if(!q.length||typeof this.state.storage.setAlarm!=='function')return;const next=Math.min(...q.map(x=>Math.max(Date.now()+50,Number(x.nextAttemptAt)||Date.now())));this.state.storage.setAlarm(next)}
 queueTournamentResultNotifications(){if(!this.data||this.data.status!=='finished')return 0;let added=0;const fieldSize=this.data.players.length;for(const p of this.data.players){if(!p.accountId||!Number.isInteger(p.finishPlace))continue;if(this.queueTelegramNotification({id:`result:${this.data.code}:${p.id}`,kind:'tournament-result',playerId:p.id,code:this.data.code,finishPlace:p.finishPlace,fieldSize}))added++}return added}
 async flushTelegramNotifications(now=Date.now()){const q=(this.data?.telegramNotifications||[]).filter(x=>x.status==='pending'&&(Number(x.nextAttemptAt)||0)<=now).slice(0,8);if(!q.length){this.scheduleTelegramNotifications();return}for(const event of q){const p=this.player(event.playerId),result=p?.accountId?await sendTelegramTournamentNotification(this.env,p.accountId,event):{sent:false,retryable:false,reason:'no-account'};event.attempts=nonNegativeInt(event.attempts)+1;event.lastAttemptAt=Date.now();if(result.sent){event.status='delivered';event.deliveredAt=Date.now();event.lastError=null}else if(result.retryable&&event.attempts<5){event.nextAttemptAt=Date.now()+Math.min(30000,1000*(2**Math.max(0,event.attempts-1)));event.lastError=result.reason||'Telegram delivery failed.'}else{event.status='failed';event.failedAt=Date.now();event.lastError=result.reason||'Telegram delivery failed.'}}await this.save();this.scheduleTelegramNotifications()}
 async alarm(){await this.load();if(this.data)await this.flushTelegramNotifications()}
 maybeScheduleMoves(boundaryTableNumber){
  if(this.data.status!=='running'||activeField(this.data).length<=1)return[];
  if((this.data.pendingMoves||[]).some(m=>!m.acknowledged))return[];
  const next=nextTournamentMove(this.data);if(!next)return[];
  if(next.kind==='balance'){if(next.move.fromTable!==Number(boundaryTableNumber))return[];const move=movePlayer(this.data,next.move);this.bumpReportGeneration(move.fromTable);return[move]}
  const plan=planTableBreak(this.data);if(!plan||plan.sourceTable!==Number(boundaryTableNumber))return[];
  const moves=plan.moves.map(spec=>movePlayer(this.data,spec)),source=this.table(plan.sourceTable);this.bumpReportGeneration(source.tableNumber);source.status='closed';source.closedAt=Date.now();return moves;
 }
 acknowledgeMoves(tableNumber,acks){
  const items=Array.isArray(acks)?acks:[],byId=new Map(items.map(item=>typeof item==='string'?[item,{id:item}]:[String(item?.id||''),item]).filter(([id])=>id)),acked=[],table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  for(const move of this.data.pendingMoves||[]){if(move.acknowledged||move.toTable!==Number(tableNumber)||!byId.has(move.id))continue;const p=this.player(move.playerId),ack=byId.get(move.id);if(!p||p.pendingMoveId!==move.id||positiveInt(p.ownershipGeneration)!==positiveInt(move.toOwnershipGeneration))throw Error('Tournament move ownership acknowledgement is stale.');
   if(move.toSeat==null){const seat=Number(ack?.seat);if(!Number.isInteger(seat)||seat<1||seat>table.capacity)throw Error('Balancing move acknowledgement requires a valid destination seat.');const occupied=table.playerIds.map(id=>this.player(id)).filter(x=>x&&x.id!==p.id&&!x.eliminated&&x.chips>0).some(x=>validSeat(x.seat)&&Number(x.seat)===seat);if(occupied)throw Error('Balancing move destination seat is occupied.');move.toSeat=seat;p.seat=seat}
   else if(ack?.seat!=null&&Number(ack.seat)!==Number(move.toSeat))throw Error('Tournament move acknowledgement seat does not match its assigned seat.');
   move.acknowledged=true;move.acknowledgedAt=Date.now();p.reportOwnerTable=Number(tableNumber);p.pendingMoveId=null;acked.push(move.id);this.queueTelegramNotification({id:`move:${move.id}`,kind:'table-move',playerId:p.id,code:this.data.code,toTable:Number(tableNumber),toSeat:Number(p.seat)})}if(acked.length)this.bumpReportGeneration(tableNumber);return acked;
 }
 async controlTable(table,type,now=Date.now()){
  if(!this.env?.TABLES)throw Error('Poker table binding unavailable.');if(!table?.tableKey)throw Error('Tournament table key unavailable.');
  const stub=this.env.TABLES.get(this.env.TABLES.idFromName(table.tableKey)),payload={type,now,snapshot:this.tableSnapshot(table.tableNumber,now)};
  return body(await stub.fetch(new Request('https://table/mtt/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})));
 }
 async controlTables(type,now=Date.now()){
  const failures=[];for(const table of this.data.tables.filter(t=>t.provisioned&&t.status!=='closed'))try{await this.controlTable(table,type,now)}catch(e){failures.push({tableNumber:table.tableNumber,error:e.message})}return failures;
 }
 async provisionTables(){
  if(!this.env?.TABLES)throw Error('Poker table binding unavailable.');const results=[];
  for(const table of this.data.tables){
   table.tableKey??=tournamentTableKey(this.data.code,table.tableNumber);const payload=childTablePayload(this.data,table),snapshot=this.tableSnapshot(table.tableNumber),stub=this.env.TABLES.get(this.env.TABLES.idFromName(table.tableKey));
   if(!table.provisioned){
    try{await body(await stub.fetch(new Request('https://table/mtt/provision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({snapshot,config:{code:table.tableKey,startingChips:this.data.startingChips,blindStructure:this.data.clock.blindStructure,blindMinutes:this.data.clock.levelDurationMs/60000},players:payload.players})})));table.provisioned=true;table.provisionedAt=Date.now();table.provisionError=null;await this.save()}
    catch(e){table.provisionError=e.message;await this.save();throw e}
   }
   results.push({tableNumber:table.tableNumber,tableKey:table.tableKey,playerCount:table.playerIds.length,provisioned:true});
  }
  return results;
 }
 async fetch(req){
  await this.load();const u=new URL(req.url);
  if(u.pathname==='/init'&&req.method==='POST'){
   if(this.data)return json({error:'Tournament already exists.'},409);
   const b=await req.json(),entries=Array.isArray(b.players)?b.players.map(x=>({name:cleanName(x?.name||x),accountId:String(x?.accountId||'')||null,cosmetic:cleanCosmetic(x?.cosmetic)})).filter(x=>x.name):[],names=entries.map(x=>x.name);
   if(names.length<1)return json({error:'At least one player is required.'},400);
   if(names.length>MTT_MAX_PLAYERS)return json({error:`Tournament is capped at ${MTT_MAX_PLAYERS} players.`},400);
   if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)return json({error:'Tournament display names must be unique.'},400);
   const startingChips=Math.max(1,Math.trunc(Number(b.startingChips)||2500));
   const players=entries.map((entry,i)=>({id:playerId(i),token:sessionToken(),accountId:entry.accountId,name:entry.name,chips:startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:startingChips,stats:cleanStats(),cosmetic:entry.cosmetic,host:i===0,ownershipGeneration:1,reportOwnerTable:null,pendingMoveId:null}));
   const code=String(b.code||'').trim().toUpperCase();if(!code)return json({error:'Tournament code required.'},400);
   this.data={code,status:'lobby',transition:null,startingChips,players,tables:[],pendingMoves:[],eliminationLedger:[],telegramNotifications:[],clock:createTournamentClock({blindStructure:b.blindStructure,levelDurationMs:b.levelDurationMs,now:Number(b.now)||Date.now()}),createdAt:Date.now(),startedAt:null,finishedAt:null,endedAt:null,endedByHost:false,resultsSyncedAt:null};this.rebuildLobbySeating();
   await this.save();return json({...publicState(this.data,Number(b.now)||Date.now()),token:players[0].token,host:true},201)
  }
  if(!this.data)return json({error:'Tournament not found.'},404);
  if(u.pathname==='/state'&&req.method==='GET')return json(publicState(this.data));
  if(u.pathname==='/session'&&req.method==='GET'){try{return json(this.sessionState(u.searchParams.get('token')||''))}catch(e){return json({error:e.message},403)}}
  if(u.pathname==='/join'&&req.method==='POST'){try{const b=await req.json(),p=this.joinLobby(b.name,b);await this.save();return json({code:this.data.code,token:p.token,playerId:p.id,tableNumber:p.tableNumber,seat:p.seat},201)}catch(e){return json({error:e.message},409)}}
  if(u.pathname==='/provision'&&req.method==='POST'){
   if(this.transitionInFlight)return this.busy('provision');if(this.data.status!=='lobby')return json({error:'Tables can only be provisioned before the tournament starts.'},409);if(this.data.players.length<2)return json({error:'At least two players are required to provision tables.'},409);
   this.transitionInFlight='provision';try{return json({tables:await this.provisionTables()},201)}catch(e){return json({error:e.message},503)}finally{this.transitionInFlight=null}
  }
  if(u.pathname==='/start'&&req.method==='POST'){
   if(this.transitionInFlight)return this.busy('start');
   if(['running','paused'].includes(this.data.status)&&this.data.startedAt)return json(publicState(this.data));
   if(['finished','ended'].includes(this.data.status))return json({error:'Tournament is already complete.',state:publicState(this.data)},409);
   if(!['lobby','starting'].includes(this.data.status))return json({error:'Tournament cannot start from its current state.',state:publicState(this.data)},409);if(this.data.players.length<2)return json({error:'At least two players are required to start.'},409);
   this.transitionInFlight='start';
   try{
    const b=await req.json().catch(()=>({}));
    if(this.data.status==='lobby'){this.data.status='starting';this.data.transition={type:'start',startedAt:Date.now(),effectiveAt:null};await this.save()}
    else if(!this.data.transition){this.data.transition={type:'start',startedAt:Date.now(),effectiveAt:null};await this.save()}
    try{if(this.data.tables.some(t=>!t.provisioned))await this.provisionTables()}catch(e){this.data.status='lobby';this.data.transition=null;await this.save();return json({error:`Tournament table provisioning failed: ${e.message}`,state:publicState(this.data)},503)}
    const now=Number(this.data.transition?.effectiveAt)||Number(b.now)||Date.now();if(!this.data.transition.effectiveAt){this.data.transition.effectiveAt=now;this.data.startedAt=now;this.data.clock.levelStartedAt=now;this.data.clock.paused=false;this.data.clock.pausedAt=null;this.data.endedAt=null;this.data.endedByHost=false;await this.save()}
    const failures=await this.controlTables('start',now);if(failures.length){const failedAt=Date.now();pauseTournamentClock(this.data.clock,failedAt);this.data.status='paused';this.data.transition={type:'pause',startedAt:failedAt};await this.controlTables('pause',failedAt);this.data.transition=null;await this.save();return json({error:'One or more child tables could not start.',failures,state:publicState(this.data,failedAt)},503)}
    this.data.status='running';this.data.transition=null;this.data.tables.forEach(t=>{if(t.status!=='closed')t.status='running'});for(const p of this.data.players)if(!p.eliminated&&p.accountId)this.queueTelegramNotification({id:`start:${this.data.startedAt}:${p.id}`,kind:'tournament-start',playerId:p.id,code:this.data.code,tableNumber:Number(p.tableNumber),seat:Number(p.seat)});await this.save();this.scheduleTelegramNotifications();return json(publicState(this.data,now));
   }finally{this.transitionInFlight=null}
  }
  if(u.pathname==='/clock'&&req.method==='GET')return json(tournamentClockState(this.data.clock));
  if(u.pathname==='/hand-blinds'&&req.method==='GET')return json(blindsForNewHand(this.data.clock));
  const tableMatch=u.pathname.match(/^\/tables\/(\d+)\/(sync|report|ack-moves)$/);
  if(tableMatch&&tableMatch[2]==='sync'&&req.method==='GET'){try{const n=Number(tableMatch[1]);if(u.searchParams.get('atBoundary')==='1'&&this.data.status==='running'){const moves=this.maybeScheduleMoves(n);if(moves.length){this.assertTournamentChipSupply();await this.save()}}return json(this.tableSnapshot(n))}catch(e){return json({error:e.message},404)}}
  if(tableMatch&&tableMatch[2]==='report'&&req.method==='POST'){try{const n=Number(tableMatch[1]),outcome=this.reportTable(n,await req.json());if(outcome.kind==='new'&&this.data.status==='running')this.maybeScheduleMoves(n);if(this.data.status==='finished')this.queueTournamentResultNotifications();await this.save();if(this.data.status==='finished'){this.scheduleTelegramNotifications();await this.syncTournamentResults()}return json(this.tableSnapshot(n))}catch(e){return json({error:e.message},400)}}
  if(tableMatch&&tableMatch[2]==='ack-moves'&&req.method==='POST'){try{const n=Number(tableMatch[1]),b=await req.json();this.acknowledgeMoves(n,b.moves||b.moveIds);this.assertTournamentChipSupply();await this.save();this.scheduleTelegramNotifications();return json(this.tableSnapshot(n))}catch(e){return json({error:e.message},400)}}
  if(u.pathname==='/pause'&&req.method==='POST'){
   if(this.transitionInFlight)return this.busy('pause');if(this.data.status==='paused'&&!this.data.transition)return json(publicState(this.data));if(!['running','paused'].includes(this.data.status))return json({error:'Tournament is not running.',state:publicState(this.data)},409);
   this.transitionInFlight='pause';try{const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();if(this.data.status==='running')pauseTournamentClock(this.data.clock,now);this.data.status='paused';this.data.transition={type:'pause',startedAt:now};await this.save();const failures=await this.controlTables('pause',now);this.data.transition=null;await this.save();return json({...publicState(this.data,now),childFailures:failures},failures.length?503:200)}finally{this.transitionInFlight=null}
  }
  if(u.pathname==='/resume'&&req.method==='POST'){
   if(this.transitionInFlight)return this.busy('resume');if(this.data.status==='running'&&!this.data.transition)return json(publicState(this.data));if(!['paused','running'].includes(this.data.status))return json({error:'Tournament is not paused.',state:publicState(this.data)},409);
   this.transitionInFlight='resume';try{const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();if(this.data.status==='paused')resumeTournamentClock(this.data.clock,now);this.data.status='running';this.data.transition={type:'resume',startedAt:now};await this.save();const failures=await this.controlTables('resume',now);if(failures.length){const failedAt=Date.now();pauseTournamentClock(this.data.clock,failedAt);this.data.status='paused';this.data.transition={type:'pause',startedAt:failedAt};await this.controlTables('pause',failedAt);this.data.transition=null;await this.save();return json({error:'One or more child tables could not resume.',failures,state:publicState(this.data,failedAt)},503)}this.data.transition=null;await this.save();return json(publicState(this.data,now))}finally{this.transitionInFlight=null}
  }
  if(u.pathname==='/end'&&req.method==='POST'){
   if(this.transitionInFlight)return this.busy('end');if(this.data.status==='ended')return json(publicState(this.data));if(!['running','paused'].includes(this.data.status))return json({error:'Tournament is not active.',state:publicState(this.data)},409);
   this.transitionInFlight='end';try{const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();this.data.status='ended';this.data.transition={type:'end',startedAt:now};this.data.endedByHost=true;this.data.endedAt=now;this.data.pendingMoves=[];await this.save();const failures=await this.controlTables('close',now);this.data.tables.forEach(t=>{if(t.provisioned){t.status='closed';t.closedAt??=now}});this.data.transition=null;await this.save();return json({...publicState(this.data,now),childFailures:failures})}finally{this.transitionInFlight=null}
  }
  return json({error:'Not found.'},404)
 }
}

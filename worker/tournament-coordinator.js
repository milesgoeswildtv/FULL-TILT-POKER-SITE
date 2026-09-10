import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY,MTT_MAX_TABLES}from'./mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand,pauseTournamentClock,resumeTournamentClock}from'./tournament-clock.js';
import{tournamentTableKey,childTablePayload}from'./mtt-provision.js';
import{nextTournamentMove,planTableBreak,movePlayer}from'./mtt-moves.js';

const KEY='tournament';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function playerId(i){return`p${String(i+1).padStart(2,'0')}`}
function sessionToken(){return crypto.randomUUID().replace(/-/g,'')}
function nonNegativeInt(v){return Math.max(0,Math.trunc(Number(v)||0))}
function cleanStats(stats={}){return{handsPlayed:nonNegativeInt(stats.handsPlayed),handsWon:nonNegativeInt(stats.handsWon),vpipHands:nonNegativeInt(stats.vpipHands),pfrHands:nonNegativeInt(stats.pfrHands),biggestPotWon:nonNegativeInt(stats.biggestPotWon),knockouts:nonNegativeInt(stats.knockouts)}}
function activeField(d){return d.players.filter(p=>!p.eliminated&&p.chips>0)}
function publicState(d,now=Date.now()){
 const clock=d.clock?tournamentClockState(d.clock,now):null,pendingMoves=(d.pendingMoves||[]).map(({playerToken,...move})=>move);
 return{code:d.code,status:d.status,startingChips:d.startingChips,maxPlayers:MTT_MAX_PLAYERS,tableCapacity:MTT_TABLE_CAPACITY,maxTables:MTT_MAX_TABLES,clock,fieldRemaining:activeField(d).length,players:d.players.map(({token,...p})=>p),tables:d.tables,pendingMoves,createdAt:d.createdAt,startedAt:d.startedAt||null,finishedAt:d.finishedAt||null};
}
async function body(response){const b=await response.json().catch(()=>({}));if(!response.ok)throw Error(b.error||`Child table returned ${response.status}.`);return b}

export class TournamentCoordinator{
 constructor(state,env){this.state=state;this.env=env;this.data=null}
 async load(){if(this.data)return;this.data=await this.state.storage.get(KEY)||null;if(this.data){this.data.pendingMoves??=[];for(const p of this.data.players||[]){p.stats??=cleanStats();p.host=!!p.host}if(this.data.players?.length&&!this.data.players.some(p=>p.host))this.data.players[0].host=true}}
 async save(){await this.state.storage.put(KEY,this.data)}
 table(tableNumber){return this.data?.tables.find(t=>t.tableNumber===Number(tableNumber))||null}
 player(id){return this.data?.players.find(p=>p.id===id)||null}
 sessionPlayer(token){return this.data?.players.find(p=>p.token===String(token||''))||null}
 sessionState(token,now=Date.now()){
  const p=this.sessionPlayer(token);if(!p)throw Error('Invalid tournament session.');const table=this.table(p.tableNumber);
  return{tournament:publicState(this.data,now),session:{playerId:p.id,name:p.name,host:!!p.host,chips:p.chips,eliminated:!!p.eliminated,finishPlace:p.finishPlace,tableNumber:p.tableNumber,seat:p.seat,tableKey:table?.tableKey||null,tableStatus:table?.status||null,provisioned:!!table?.provisioned}};
 }
 rebuildLobbySeating(){
  if(this.data.status!=='lobby')throw Error('Tournament seating is locked.');if(this.data.tables?.some(t=>t.provisioned))throw Error('Tournament tables are already provisioned.');
  const seating=initialAssignments(this.data.players);for(const p of this.data.players){p.tableNumber=null;p.seat=null}for(const a of seating.assignments){const p=this.player(a.playerId);p.tableNumber=a.tableNumber;p.seat=a.seat}
  this.data.tables=seating.tables.map(t=>({tableNumber:t.tableNumber,tableKey:tournamentTableKey(this.data.code,t.tableNumber),capacity:t.capacity,playerIds:t.players.map(p=>p.playerId),status:'waiting',handNumber:0,lastReportAt:null,provisioned:false,provisionedAt:null,provisionError:null}));return this.data.tables;
 }
 joinLobby(name){
  if(this.data.status!=='lobby')throw Error('Tournament already started.');if(this.data.tables?.some(t=>t.provisioned))throw Error('Tournament seating is locked for start.');if(this.data.players.length>=MTT_MAX_PLAYERS)throw Error(`Tournament is capped at ${MTT_MAX_PLAYERS} players.`);
  const clean=cleanName(name);if(!clean)throw Error('Display name required.');if(this.data.players.some(p=>p.name.toLowerCase()===clean.toLowerCase()))throw Error('That display name is already registered.');
  const p={id:playerId(this.data.players.length),token:sessionToken(),name:clean,chips:this.data.startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:this.data.startingChips,stats:cleanStats(),cosmetic:'default',host:false};this.data.players.push(p);this.rebuildLobbySeating();return p;
 }
 tableSnapshot(tableNumber,now=Date.now()){
  const table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  const players=table.playerIds.map(id=>this.player(id)).filter(p=>p&&!p.eliminated&&p.chips>0).sort((a,b)=>a.seat-b.seat).map(p=>({id:p.id,token:p.token,name:p.name,chips:p.chips,eliminated:false,finishPlace:p.finishPlace,moveCount:p.moveCount,tableNumber:p.tableNumber,seat:p.seat,stats:cleanStats(p.stats),cosmetic:String(p.cosmetic||'default')}));
  const moves=(this.data.pendingMoves||[]).filter(m=>!m.acknowledged&&(m.fromTable===table.tableNumber||m.toTable===table.tableNumber)).map(m=>({...m}));
  return{tournamentCode:this.data.code,tableNumber:table.tableNumber,tableKey:table.tableKey,status:this.data.status,tableStatus:table.status,fieldRemaining:activeField(this.data).length,players,moves,clock:tournamentClockState(this.data.clock,now),handBlinds:blindsForNewHand(this.data.clock,now)};
 }
 reportTable(tableNumber,report){
  const table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  if(!Array.isArray(report?.players))throw Error('Table report players required.');
  const pendingFrom=(this.data.pendingMoves||[]).filter(m=>!m.acknowledged&&m.fromTable===table.tableNumber).map(m=>m.playerId),allowed=new Set([...table.playerIds,...pendingFrom]),allowedPlayers=[...allowed].map(id=>this.player(id)).filter(Boolean),newlyBusted=[];
  for(const row of report.players){
   const p=allowed.has(row.id)?this.player(row.id):allowedPlayers.find(x=>x.name===row.name);if(!p||!allowed.has(p.id))throw Error('Table reported a player not assigned to it.');
   const wasAlive=!p.eliminated&&p.chips>0,chips=nonNegativeInt(row.chips);p.chips=chips;p.stats=cleanStats(row.stats||p.stats);p.cosmetic=String(row.cosmetic||p.cosmetic||'default').slice(0,32);p.handStartChips=nonNegativeInt(row.handStartChips);
   if(wasAlive&&chips===0){p.eliminated=true;newlyBusted.push(p)}
  }
  const survivors=activeField(this.data).length;newlyBusted.sort((a,b)=>(b.handStartChips||0)-(a.handStartChips||0)||a.id.localeCompare(b.id)).forEach((p,i)=>{if(!Number.isInteger(p.finishPlace))p.finishPlace=survivors+i+1});
  if(survivors===1){const winner=activeField(this.data)[0];winner.finishPlace=1;this.data.status='finished';this.data.finishedAt??=Date.now()}
  table.lastReportAt=Date.now();table.handNumber=Math.max(0,Math.trunc(Number(report.handNumber)||0));if(table.status!=='closed')table.status=String(report.status||table.status||'running');
  return newlyBusted;
 }
 maybeScheduleMoves(boundaryTableNumber){
  if(this.data.status!=='running'||activeField(this.data).length<=1)return[];
  if((this.data.pendingMoves||[]).some(m=>!m.acknowledged))return[];
  const next=nextTournamentMove(this.data);if(!next)return[];
  if(next.kind==='balance'){if(next.move.fromTable!==Number(boundaryTableNumber))return[];return[movePlayer(this.data,next.move)]}
  const plan=planTableBreak(this.data);if(!plan||plan.sourceTable!==Number(boundaryTableNumber))return[];
  const moves=plan.moves.map(spec=>movePlayer(this.data,spec)),source=this.table(plan.sourceTable);source.status='closed';source.closedAt=Date.now();return moves;
 }
 acknowledgeMoves(tableNumber,moveIds){
  const ids=new Set(Array.isArray(moveIds)?moveIds:[]),acked=[];
  for(const move of this.data.pendingMoves||[]){if(!move.acknowledged&&move.toTable===Number(tableNumber)&&ids.has(move.id)){move.acknowledged=true;move.acknowledgedAt=Date.now();acked.push(move.id)}}
  return acked;
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
   const b=await req.json(),names=Array.isArray(b.players)?b.players.map(x=>cleanName(x?.name||x)).filter(Boolean):[];
   if(names.length<1)return json({error:'At least one player is required.'},400);
   if(names.length>MTT_MAX_PLAYERS)return json({error:`Tournament is capped at ${MTT_MAX_PLAYERS} players.`},400);
   if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)return json({error:'Tournament display names must be unique.'},400);
   const startingChips=Math.max(1,Math.trunc(Number(b.startingChips)||2500));
   const players=names.map((name,i)=>({id:playerId(i),token:sessionToken(),name,chips:startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:startingChips,stats:cleanStats(),cosmetic:'default',host:i===0}));
   const code=String(b.code||'').trim().toUpperCase();if(!code)return json({error:'Tournament code required.'},400);
   this.data={code,status:'lobby',startingChips,players,tables:[],pendingMoves:[],clock:createTournamentClock({blindStructure:b.blindStructure,levelDurationMs:b.levelDurationMs,now:Number(b.now)||Date.now()}),createdAt:Date.now(),startedAt:null,finishedAt:null};this.rebuildLobbySeating();
   await this.save();return json({...publicState(this.data,Number(b.now)||Date.now()),token:players[0].token,host:true},201)
  }
  if(!this.data)return json({error:'Tournament not found.'},404);
  if(u.pathname==='/state'&&req.method==='GET')return json(publicState(this.data));
  if(u.pathname==='/session'&&req.method==='GET'){try{return json(this.sessionState(u.searchParams.get('token')||''))}catch(e){return json({error:e.message},403)}}
  if(u.pathname==='/join'&&req.method==='POST'){try{const b=await req.json(),p=this.joinLobby(b.name);await this.save();return json({code:this.data.code,token:p.token,playerId:p.id,tableNumber:p.tableNumber,seat:p.seat},201)}catch(e){return json({error:e.message},409)}}
  if(u.pathname==='/provision'&&req.method==='POST'){if(this.data.status!=='lobby')return json({error:'Tables can only be provisioned before the tournament starts.'},409);if(this.data.players.length<2)return json({error:'At least two players are required to provision tables.'},409);try{return json({tables:await this.provisionTables()},201)}catch(e){return json({error:e.message},503)}}
  if(u.pathname==='/start'&&req.method==='POST'){
   if(this.data.status!=='lobby')return json({error:'Tournament already started.'},409);if(this.data.players.length<2)return json({error:'At least two players are required to start.'},409);
   try{if(this.data.tables.some(t=>!t.provisioned))await this.provisionTables()}catch(e){return json({error:`Tournament table provisioning failed: ${e.message}`,state:publicState(this.data)},503)}
   const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();this.data.status='running';this.data.startedAt=now;this.data.clock.levelStartedAt=now;this.data.clock.paused=false;this.data.clock.pausedAt=null;this.data.tables.forEach(t=>{if(t.status!=='closed')t.status='running'});await this.save();
   const failures=await this.controlTables('start',now);if(failures.length){pauseTournamentClock(this.data.clock,now);this.data.status='paused';await this.controlTables('pause',now);await this.save();return json({error:'One or more child tables could not start.',failures,state:publicState(this.data,now)},503)}
   return json(publicState(this.data,now));
  }
  if(u.pathname==='/clock'&&req.method==='GET')return json(tournamentClockState(this.data.clock));
  if(u.pathname==='/hand-blinds'&&req.method==='GET')return json(blindsForNewHand(this.data.clock));
  const tableMatch=u.pathname.match(/^\/tables\/(\d+)\/(sync|report|ack-moves)$/);
  if(tableMatch&&tableMatch[2]==='sync'&&req.method==='GET'){try{return json(this.tableSnapshot(Number(tableMatch[1])))}catch(e){return json({error:e.message},404)}}
  if(tableMatch&&tableMatch[2]==='report'&&req.method==='POST'){try{const n=Number(tableMatch[1]);this.reportTable(n,await req.json());this.maybeScheduleMoves(n);await this.save();return json(this.tableSnapshot(n))}catch(e){return json({error:e.message},400)}}
  if(tableMatch&&tableMatch[2]==='ack-moves'&&req.method==='POST'){try{const n=Number(tableMatch[1]),b=await req.json();this.acknowledgeMoves(n,b.moveIds);this.maybeScheduleMoves(n);await this.save();return json(this.tableSnapshot(n))}catch(e){return json({error:e.message},400)}}
  if(u.pathname==='/pause'&&req.method==='POST'){if(this.data.status!=='running')return json({error:'Tournament is not running.'},409);const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();pauseTournamentClock(this.data.clock,now);this.data.status='paused';await this.save();const failures=await this.controlTables('pause',now);return json({...publicState(this.data,now),childFailures:failures},failures.length?503:200)}
  if(u.pathname==='/resume'&&req.method==='POST'){if(this.data.status!=='paused')return json({error:'Tournament is not paused.'},409);const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();resumeTournamentClock(this.data.clock,now);this.data.status='running';await this.save();const failures=await this.controlTables('resume',now);if(failures.length){pauseTournamentClock(this.data.clock,now);this.data.status='paused';await this.controlTables('pause',now);await this.save();return json({error:'One or more child tables could not resume.',failures,state:publicState(this.data,now)},503)}return json(publicState(this.data,now))}
  return json({error:'Not found.'},404)
 }
}

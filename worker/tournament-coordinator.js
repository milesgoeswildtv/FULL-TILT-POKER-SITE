import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY,MTT_MAX_TABLES}from'./mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand,pauseTournamentClock,resumeTournamentClock}from'./tournament-clock.js';
import{tournamentTableKey,childTablePayload}from'./mtt-provision.js';

const KEY='tournament';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function playerId(i){return`p${String(i+1).padStart(2,'0')}`}
function sessionToken(){return crypto.randomUUID().replace(/-/g,'')}
function publicState(d,now=Date.now()){
 const clock=d.clock?tournamentClockState(d.clock,now):null;
 return{code:d.code,status:d.status,startingChips:d.startingChips,maxPlayers:MTT_MAX_PLAYERS,tableCapacity:MTT_TABLE_CAPACITY,maxTables:MTT_MAX_TABLES,clock,players:d.players.map(({token,...p})=>p),tables:d.tables,createdAt:d.createdAt,startedAt:d.startedAt||null};
}
async function body(response){const b=await response.json().catch(()=>({}));if(!response.ok)throw Error(b.error||`Child table returned ${response.status}.`);return b}

export class TournamentCoordinator{
 constructor(state,env){this.state=state;this.env=env;this.data=null}
 async load(){if(this.data)return;this.data=await this.state.storage.get(KEY)||null}
 async save(){await this.state.storage.put(KEY,this.data)}
 table(tableNumber){return this.data?.tables.find(t=>t.tableNumber===Number(tableNumber))||null}
 player(id){return this.data?.players.find(p=>p.id===id)||null}
 tableSnapshot(tableNumber,now=Date.now()){
  const table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  const players=table.playerIds.map(id=>this.player(id)).filter(Boolean).map(p=>({id:p.id,name:p.name,chips:p.chips,eliminated:!!p.eliminated,finishPlace:p.finishPlace,moveCount:p.moveCount,tableNumber:p.tableNumber,seat:p.seat}));
  return{tournamentCode:this.data.code,tableNumber:table.tableNumber,tableKey:table.tableKey,status:this.data.status,players,clock:tournamentClockState(this.data.clock,now),handBlinds:blindsForNewHand(this.data.clock,now)};
 }
 reportTable(tableNumber,report){
  const table=this.table(tableNumber);if(!table)throw Error('Tournament table not found.');
  if(!Array.isArray(report?.players))throw Error('Table report players required.');
  const allowed=new Set(table.playerIds),allowedPlayers=table.playerIds.map(id=>this.player(id)).filter(Boolean);
  for(const row of report.players){let p=allowed.has(row.id)?this.player(row.id):allowedPlayers.find(x=>x.name===row.name);if(!p||!allowed.has(p.id))throw Error('Table reported a player not assigned to it.');const chips=Math.max(0,Math.trunc(Number(row.chips)||0));p.chips=chips;if(row.eliminated||chips===0)p.eliminated=true;if(Number.isInteger(row.finishPlace))p.finishPlace=row.finishPlace}
  table.lastReportAt=Date.now();table.handNumber=Math.max(0,Math.trunc(Number(report.handNumber)||0));table.status=String(report.status||table.status||'running');
 }
 async provisionTables(){
  if(!this.env?.TABLES)throw Error('Poker table binding unavailable.');
  const results=[];
  for(const table of this.data.tables){
   table.tableKey??=tournamentTableKey(this.data.code,table.tableNumber);const payload=childTablePayload(this.data,table),[host,...guests]=payload.players;
   const stub=this.env.TABLES.get(this.env.TABLES.idFromName(table.tableKey));
   if(!table.provisioned){
    const init=await body(await stub.fetch(new Request('https://table/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:table.tableKey,hostName:host.name,startingChips:this.data.startingChips,blindStructure:this.data.clock.blindStructure,blindMinutes:this.data.clock.levelDurationMs/60000,tournamentCode:this.data.code,tournamentTableNumber:table.tableNumber})})));
    const hostPlayer=this.player(host.tournamentPlayerId);hostPlayer.token=init.token;
    for(const guest of guests){const joined=await body(await stub.fetch(new Request('https://table/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:guest.name})})));this.player(guest.tournamentPlayerId).token=joined.token}
    table.provisioned=true;table.provisionedAt=Date.now();
   }
   results.push({tableNumber:table.tableNumber,tableKey:table.tableKey,playerCount:table.playerIds.length});
  }
  await this.save();return results;
 }
 async fetch(req){
  await this.load();const u=new URL(req.url);
  if(u.pathname==='/init'&&req.method==='POST'){
   if(this.data)return json({error:'Tournament already exists.'},409);
   const b=await req.json(),names=Array.isArray(b.players)?b.players.map(x=>cleanName(x?.name||x)).filter(Boolean):[];
   if(names.length<2)return json({error:'At least two players are required.'},400);
   if(names.length>MTT_MAX_PLAYERS)return json({error:`Tournament is capped at ${MTT_MAX_PLAYERS} players.`},400);
   if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)return json({error:'Tournament display names must be unique.'},400);
   const startingChips=Math.max(1,Math.trunc(Number(b.startingChips)||2500));
   const players=names.map((name,i)=>({id:playerId(i),token:sessionToken(),name,chips:startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null}));
   const seating=initialAssignments(players);for(const a of seating.assignments){const p=players.find(x=>x.id===a.playerId);p.tableNumber=a.tableNumber;p.seat=a.seat}
   const code=String(b.code||'').trim().toUpperCase();if(!code)return json({error:'Tournament code required.'},400);
   this.data={code,status:'lobby',startingChips,players,tables:seating.tables.map(t=>({tableNumber:t.tableNumber,tableKey:tournamentTableKey(code,t.tableNumber),capacity:t.capacity,playerIds:t.players.map(p=>p.playerId),status:'waiting',handNumber:0,lastReportAt:null,provisioned:false})),clock:createTournamentClock({blindStructure:b.blindStructure,levelDurationMs:b.levelDurationMs,now:Number(b.now)||Date.now()}),createdAt:Date.now(),startedAt:null};
   await this.save();return json(publicState(this.data,Number(b.now)||Date.now()),201)
  }
  if(!this.data)return json({error:'Tournament not found.'},404);
  if(u.pathname==='/state'&&req.method==='GET')return json(publicState(this.data));
  if(u.pathname==='/provision'&&req.method==='POST'){try{return json({tables:await this.provisionTables()},201)}catch(e){return json({error:e.message},500)}}
  if(u.pathname==='/start'&&req.method==='POST'){
   if(this.data.status!=='lobby')return json({error:'Tournament already started.'},409);
   if(this.data.tables.some(t=>!t.provisioned))return json({error:'Tournament tables must be provisioned before start.'},409);
   const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();this.data.status='running';this.data.startedAt=now;this.data.clock.levelStartedAt=now;this.data.tables.forEach(t=>t.status='running');await this.save();return json(publicState(this.data,now));
  }
  if(u.pathname==='/clock'&&req.method==='GET')return json(tournamentClockState(this.data.clock));
  if(u.pathname==='/hand-blinds'&&req.method==='GET')return json(blindsForNewHand(this.data.clock));
  const tableMatch=u.pathname.match(/^\/tables\/(\d+)\/(sync|report)$/);
  if(tableMatch&&tableMatch[2]==='sync'&&req.method==='GET'){try{return json(this.tableSnapshot(Number(tableMatch[1])))}catch(e){return json({error:e.message},404)}}
  if(tableMatch&&tableMatch[2]==='report'&&req.method==='POST'){try{this.reportTable(Number(tableMatch[1]),await req.json());await this.save();return json(this.tableSnapshot(Number(tableMatch[1])))}catch(e){return json({error:e.message},400)}}
  if(u.pathname==='/pause'&&req.method==='POST'){const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();pauseTournamentClock(this.data.clock,now);this.data.status='paused';await this.save();return json(publicState(this.data,now))}
  if(u.pathname==='/resume'&&req.method==='POST'){const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();resumeTournamentClock(this.data.clock,now);this.data.status='running';await this.save();return json(publicState(this.data,now))}
  return json({error:'Not found.'},404)
 }
}

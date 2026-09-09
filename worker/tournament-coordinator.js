import{initialAssignments,MTT_MAX_PLAYERS,MTT_TABLE_CAPACITY,MTT_MAX_TABLES}from'./mtt.js';
import{createTournamentClock,tournamentClockState,blindsForNewHand,pauseTournamentClock,resumeTournamentClock}from'./tournament-clock.js';

const KEY='tournament';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function playerId(i){return`p${String(i+1).padStart(2,'0')}`}
function publicState(d,now=Date.now()){
 const clock=d.clock?tournamentClockState(d.clock,now):null;
 return{code:d.code,status:d.status,startingChips:d.startingChips,maxPlayers:MTT_MAX_PLAYERS,tableCapacity:MTT_TABLE_CAPACITY,maxTables:MTT_MAX_TABLES,clock,players:d.players.map(({token,...p})=>p),tables:d.tables,createdAt:d.createdAt,startedAt:d.startedAt||null};
}

export class TournamentCoordinator{
 constructor(state,env){this.state=state;this.env=env;this.data=null}
 async load(){if(this.data)return;this.data=await this.state.storage.get(KEY)||null}
 async save(){await this.state.storage.put(KEY,this.data)}
 async fetch(req){
  await this.load();const u=new URL(req.url);
  if(u.pathname==='/init'&&req.method==='POST'){
   if(this.data)return json({error:'Tournament already exists.'},409);
   const b=await req.json(),names=Array.isArray(b.players)?b.players.map(x=>cleanName(x?.name||x)).filter(Boolean):[];
   if(names.length<2)return json({error:'At least two players are required.'},400);
   if(names.length>MTT_MAX_PLAYERS)return json({error:`Tournament is capped at ${MTT_MAX_PLAYERS} players.`},400);
   const startingChips=Math.max(1,Math.trunc(Number(b.startingChips)||2500));
   const players=names.map((name,i)=>({id:playerId(i),name,chips:startingChips,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null}));
   const seating=initialAssignments(players);for(const a of seating.assignments){const p=players.find(x=>x.id===a.playerId);p.tableNumber=a.tableNumber;p.seat=a.seat}
   this.data={code:String(b.code||''),status:'lobby',startingChips,players,tables:seating.tables.map(t=>({tableNumber:t.tableNumber,capacity:t.capacity,playerIds:t.players.map(p=>p.playerId),status:'waiting'})),clock:createTournamentClock({blindStructure:b.blindStructure,levelDurationMs:b.levelDurationMs,now:Number(b.now)||Date.now()}),createdAt:Date.now(),startedAt:null};
   await this.save();return json(publicState(this.data,Number(b.now)||Date.now()),201)
  }
  if(!this.data)return json({error:'Tournament not found.'},404);
  if(u.pathname==='/state'&&req.method==='GET')return json(publicState(this.data));
  if(u.pathname==='/start'&&req.method==='POST'){
   if(this.data.status!=='lobby')return json({error:'Tournament already started.'},409);
   const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();this.data.status='running';this.data.startedAt=now;this.data.clock.levelStartedAt=now;this.data.tables.forEach(t=>t.status='running');await this.save();return json(publicState(this.data,now));
  }
  if(u.pathname==='/clock'&&req.method==='GET')return json(tournamentClockState(this.data.clock));
  if(u.pathname==='/hand-blinds'&&req.method==='GET')return json(blindsForNewHand(this.data.clock));
  if(u.pathname==='/pause'&&req.method==='POST'){const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();pauseTournamentClock(this.data.clock,now);this.data.status='paused';await this.save();return json(publicState(this.data,now))}
  if(u.pathname==='/resume'&&req.method==='POST'){const b=await req.json().catch(()=>({})),now=Number(b.now)||Date.now();resumeTournamentClock(this.data.clock,now);this.data.status='running';await this.save();return json(publicState(this.data,now))}
  return json({error:'Not found.'},404)
 }
}

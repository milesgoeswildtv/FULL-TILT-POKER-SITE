import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/app.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{MTT_MAX_PLAYERS}from'../worker/mtt.js';

const STARTING_CHIPS=2500,TOTAL_CHIPS=STARTING_CHIPS*MTT_MAX_PLAYERS;
const BLINDS=[[10,20],[25,50],[50,100],[100,200],[200,400],[400,800],[800,1600],[1600,3200],[3200,6400],[6400,12800],[12800,25600],[25600,51200],[51200,102400]];

function memoryState(){const data=new Map();let alarm=null;return{storage:{async get(key){return data.get(key)},async put(key,value){data.set(key,value)},setAlarm(value){alarm=value;return Promise.resolve()},deleteAlarm(){alarm=null;return Promise.resolve()},async getAlarm(){return alarm}},getWebSockets(){return[]},acceptWebSocket(){}}}
class MemoryNamespace{
 constructor(factory){this.factory=factory;this.instances=new Map()}
 idFromName(name){return String(name)}
 instance(name){const key=String(name);if(!this.instances.has(key))this.instances.set(key,this.factory(memoryState(),key));return this.instances.get(key)}
 get(name){const object=this.instance(name);return{fetch:req=>object.fetch(req)}}
}
function jsonRequest(url,body){return new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}
async function responseJson(response){const body=await response.json().catch(()=>({}));assert.ok(response.ok,body.error||`HTTP ${response.status}`);return body}

async function makeWorld(run){const env={};const tables=new MemoryNamespace(state=>new PokerTable(state,env)),tournaments=new MemoryNamespace(state=>new TournamentCoordinator(state,env));env.TABLES=tables;env.TOURNAMENTS=tournaments;const code=`T${String(run).padStart(5,'0')}`,coordinator=tournaments.instance(code),names=Array.from({length:MTT_MAX_PLAYERS},(_,i)=>`Bot ${String(i+1).padStart(2,'0')}`),now=Date.now();await responseJson(await coordinator.fetch(jsonRequest('https://tournament/init',{code,players:names,startingChips:STARTING_CHIPS,blindStructure:BLINDS,levelDurationMs:1000,now})));await responseJson(await coordinator.fetch(jsonRequest('https://tournament/provision',{})));await responseJson(await coordinator.fetch(jsonRequest('https://tournament/start',{now})));return{env,tables,coordinator}}

function livePlayers(table){return(table.data?.players||[]).filter(p=>!p.eliminated&&p.chips>0)}
function chooseAction(table,p){const d=table.data,toCall=Math.max(0,d.currentBet-p.bet),raiseOpen=table.raiseIsOpen(p),canAllIn=p.bet+p.chips<=d.currentBet||raiseOpen;if(canAllIn)return'allin';return toCall>0?'call':'check'}
function playAllInHand(table){let actions=0;for(let guard=0;guard<500;guard++){const d=table.data;if(!d?.started||d.paused||d.street==='showdown'||d.street==='finished')break;const p=d.players[d.turnIndex];if(!p||p.eliminated||p.folded||p.chips<=0){table.advance();continue}table.act(p,chooseAction(table,p),0);actions++}assert.ok(actions>0||table.data.street==='showdown'||table.data.street==='finished','live table made no progress');assert.ok(table.data.street==='showdown'||table.data.street==='finished',`hand stalled on ${table.data.street}`);return actions}

function coordinatorInvariants(coordinator){const d=coordinator.data,total=d.players.reduce((sum,p)=>sum+p.chips,0),active=d.players.filter(p=>!p.eliminated&&p.chips>0);assert.equal(total,TOTAL_CHIPS,'coordinator lost or created chips');assert.ok(d.players.every(p=>Number.isInteger(p.chips)&&p.chips>=0));const activeIds=new Set();for(const table of d.tables){const seats=new Set();for(const id of table.playerIds){const p=d.players.find(x=>x.id===id);if(!p||p.eliminated||p.chips<=0)continue;assert.equal(p.tableNumber,table.tableNumber);assert.ok(!activeIds.has(id),'active player assigned to two tables');activeIds.add(id);assert.ok(!seats.has(p.seat),'duplicate active seat');seats.add(p.seat);assert.ok(p.seat>=1&&p.seat<=table.capacity)}if(table.status==='closed')assert.equal([...table.playerIds].filter(id=>{const p=d.players.find(x=>x.id===id);return p&&!p.eliminated&&p.chips>0}).length,0)}assert.equal(activeIds.size,active.length);const places=d.players.map(p=>p.finishPlace).filter(Number.isInteger);assert.equal(new Set(places).size,places.length,'duplicate global finish place');for(const move of(d.pendingMoves||[]).filter(m=>!m.acknowledged)){const s=coordinator.sessionState(move.playerToken).session;assert.equal(s.tableNumber,move.toTable);assert.equal(s.seat,move.toSeat)}}

async function expireBoundary(table){if(table.data?.street!=='showdown')return false;table.data.phaseDeadline=Date.now()-1;return table.finishMTTBoundary()}
async function pauseResumeAll(coordinator,tables){if(coordinator.data.status!=='running')return;const now=Date.now(),pause=await responseJson(await coordinator.fetch(jsonRequest('https://tournament/pause',{now})));assert.equal(pause.status,'paused');for(const meta of coordinator.data.tables.filter(t=>t.provisioned&&t.status!=='closed')){const table=tables.instance(meta.tableKey);assert.equal(table.data.paused,true)}const resume=await responseJson(await coordinator.fetch(jsonRequest('https://tournament/resume',{now:now+5000})));assert.equal(resume.status,'running');for(const meta of coordinator.data.tables.filter(t=>t.provisioned&&t.status!=='closed')){const table=tables.instance(meta.tableKey);assert.equal(table.data.paused,false)}}

async function runFullEngineTournament(run){const{tables,coordinator}=await makeWorld(run);assert.equal(coordinator.data.tables.length,7);assert.deepEqual(coordinator.data.tables.map(t=>t.playerIds.length),[8,7,7,7,7,7,7]);coordinatorInvariants(coordinator);await pauseResumeAll(coordinator,tables);let hands=0,actions=0,maxPending=0,breakSeen=false,balanceSeen=false;
 for(let cycle=0;cycle<200&&coordinator.data.status!=='finished';cycle++){
  if(cycle===2||cycle===6)await pauseResumeAll(coordinator,tables);
  // Make the global clock race ahead without touching live-hand snapshots. New hands pick up the new level at their own boundary.
  coordinator.data.clock.levelStartedAt-=1250;
  for(const meta of coordinator.data.tables){if(coordinator.data.status==='finished')break;if(meta.status==='closed')continue;const table=tables.instance(meta.tableKey);await table.load();if(!table.data)continue;
   if(table.data.street==='showdown'){await expireBoundary(table)}else if(table.data.started&&table.data.street!=='finished'){actions+=playAllInHand(table);hands++;await expireBoundary(table)}
   const pending=(coordinator.data.pendingMoves||[]).filter(m=>!m.acknowledged);maxPending=Math.max(maxPending,pending.length);if(pending.some(m=>m.kind==='break'))breakSeen=true;if(pending.some(m=>m.kind==='balance'))balanceSeen=true;coordinatorInvariants(coordinator)
  }
 }
 assert.equal(coordinator.data.status,'finished',`full engine run ${run} did not finish`);
 // Let any destination table consume a final in-flight move notice after the winner is known.
 for(let guard=0;guard<20&&(coordinator.data.pendingMoves||[]).some(m=>!m.acknowledged);guard++)for(const meta of coordinator.data.tables){const table=tables.instance(meta.tableKey);if(table.data?.street==='showdown')await expireBoundary(table)}
 coordinatorInvariants(coordinator);const active=coordinator.data.players.filter(p=>!p.eliminated&&p.chips>0),winner=coordinator.data.players.find(p=>p.finishPlace===1);assert.equal(active.length,1);assert.equal(winner?.id,active[0].id);assert.equal(winner.chips,TOTAL_CHIPS);assert.deepEqual(coordinator.data.players.map(p=>p.finishPlace).sort((a,b)=>a-b),Array.from({length:MTT_MAX_PLAYERS},(_,i)=>i+1));assert.ok(hands>=7);assert.ok(actions>0);assert.ok(maxPending>0,'simulation never exercised an in-flight table move');assert.ok(breakSeen,'simulation never exercised a table break');return{hands,actions,maxPending,breakSeen,balanceSeen}}

test('10 complete 50-player tournaments run through real PokerTable hands and the real coordinator',async()=>{const total={hands:0,actions:0,maxPending:0,breaks:0,balances:0};for(let run=1;run<=10;run++){const r=await runFullEngineTournament(run);total.hands+=r.hands;total.actions+=r.actions;total.maxPending=Math.max(total.maxPending,r.maxPending);total.breaks+=Number(r.breakSeen);total.balances+=Number(r.balanceSeen)}assert.equal(total.breaks,10);console.log('Full engine MTT simulation summary',total)});

import test from'node:test';
import assert from'node:assert/strict';
import{PokerTable}from'../worker/app.js';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{MTT_MAX_PLAYERS}from'../worker/mtt.js';
import{settleContributions}from'../worker/settlement.js';

const RANKS=['2','3','4','5','6','7','8','9','T','J','Q','K','A'],SUITS=['♠','♥','♦','♣'];
const DECK=RANKS.flatMap(r=>SUITS.map(s=>r+s));
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function int(r,n){return Math.floor(r()*n)}
function shuffle(r,items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=int(r,i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function storageState(){const data=new Map();let alarm=null;return{storage:{async get(k){return data.get(k)},async put(k,v){data.set(k,v)},setAlarm(v){alarm=v;return Promise.resolve()},deleteAlarm(){alarm=null;return Promise.resolve()},async getAlarm(){return alarm}},getWebSockets(){return[]},acceptWebSocket(){}}}
function stats(){return{handsPlayed:0,handsWon:0,vpipHands:0,pfrHands:0,biggestPotWon:0,knockouts:0,chipsWon:0}}
function player(i,chips){return{id:'p'+i,token:'tok-'+i,name:'P'+i,chips,bet:0,contributed:0,host:i===1,testBot:false,accountId:null,cosmetic:'default',sittingOut:false,timeBankMs:60000,folded:false,eliminated:false,finishPlace:null,cards:[],stats:stats(),handStartChips:chips,vpipThisHand:false,pfrThisHand:false}}
function singleTable(count,seed){
 const r=rng(seed),starting=[400,600,1000,1500,2500][int(r,5)],bb=[10,20,40,50][int(r,4)],sb=Math.max(1,Math.floor(bb/2)),ante=r()<.35?bb:0,players=Array.from({length:count},(_,i)=>player(i+1,starting));
 const t=new PokerTable(storageState(),{});t.data={code:'SIM'+String(seed).slice(-3),startingChips:starting,blindMinutes:10,blindLevel:0,smallBlind:sb,bigBlind:bb,ante,levelStartedAt:Date.now(),started:true,paused:false,players,board:[],burned:[],pot:0,deck:[],dealerIndex:int(r,count),turnIndex:0,currentBet:0,openingBet:0,minRaise:bb,street:'waiting',acted:{},actedAtBet:{},message:'',lastResult:null,handHistory:[],placements:[],turnSeconds:30,turnDeadline:null,phaseDeadline:null,handNumber:0,fairness:null,spectators:[],chat:[],blindStructure:[[sb,bb],[bb,bb*2],[bb*2,bb*4]],actionLog:[],mttMoveNotices:{},accountStatsDirty:false,mttBoundaryReportedSequence:0,mttSyncFailureCount:0,turnSerial:0,turnReminderAt:null,turnReminderSentSerial:0,handReplay:null,rabbitCandidate:null};
 return{t,r,total:count*starting};
}
function assertTableInvariant(t,total,label){
 const d=t.data,stack=d.players.reduce((n,p)=>n+Number(p.chips||0),0),pot=Number(d.pot||0);
 assert.equal(stack+pot,total,label+' chip conservation');
 assert.ok(d.players.every(p=>Number.isInteger(p.chips)&&p.chips>=0&&Number.isInteger(p.bet)&&p.bet>=0&&Number.isInteger(p.contributed)&&p.contributed>=0),label+' nonnegative integer chips');
 assert.ok(Number.isInteger(pot)&&pot>=0,label+' nonnegative integer pot');
 if(d.fairness?.commitment&&d.street!=='finished')assert.equal(t.verifyDeck(),true,label+' deck integrity');
}
function randomAction(t,r){
 t.driveTestBots();const d=t.data,p=d.players[d.turnIndex];if(!p||d.street==='showdown'||d.street==='finished')return false;
 if(p.sittingOut){t.driveTestBots();return true}
 if(r()<.025&&p.timeBankMs>0&&d.turnDeadline>Date.now()+1000){try{t.useTimeBank(p)}catch{}}
 if(r()<.035){d.turnDeadline=Date.now()-1;t.handleTurnTimeout();return true}
 const toCall=t.toCall(p),current=t.betToMatch(),max=p.bet+p.chips,raiseOpen=t.raiseIsOpen(p),opp=t.hasRaiseOpponent(p),canRaise=opp&&raiseOpen&&max>current,canAllIn=max<=current||(opp&&raiseOpen),x=r();
 if(toCall===0){
  if(x<.08){t.act(p,'fold',0);return true}
  if(x<.22&&canAllIn){t.act(p,'allin',0);return true}
  if(x<.45&&canRaise){
   const min=current+d.minRaise;if(max>=min)t.act(p,'raise',min+int(r,max-min+1));else t.act(p,'allin',0);return true
  }
  t.act(p,'check',0);return true
 }
 if(x<.20){t.act(p,'fold',0);return true}
 if(x<.62){t.act(p,'call',0);return true}
 if(x<.78&&canAllIn){t.act(p,'allin',0);return true}
 if(canRaise){const min=current+d.minRaise;if(max>=min)t.act(p,'raise',min+int(r,max-min+1));else t.act(p,'allin',0);return true}
 t.act(p,'call',0);return true
}

test('AUDIT: 25,000 randomized side-pot settlements conserve every chip',{timeout:300000},()=>{
 for(let seed=1;seed<=25000;seed++){
  const r=rng(seed*7919),n=2+int(r,8),deck=shuffle(r,DECK),board=deck.splice(0,5),players=[];
  for(let i=0;i<n;i++)players.push({id:'p'+i,name:'P'+i,contributed:int(r,2501),folded:r()<.35,cards:[deck.pop(),deck.pop()]});
  if(!players.some(p=>p.contributed>0))players[0].contributed=1;
  const contributors=players.filter(p=>p.contributed>0);if(!contributors.some(p=>!p.folded))contributors[0].folded=false;
  const result=settleContributions(players,board,int(r,n)),input=players.reduce((sum,p)=>sum+p.contributed,0),awards=[...result.awards.values()].reduce((a,b)=>a+b,0),returns=[...result.returns.values()].reduce((a,b)=>a+b,0);
  assert.equal(result.total,input,'seed '+seed+' total');assert.equal(awards+returns,input,'seed '+seed+' awards+returns');
  assert.equal(result.contestedTotal+result.returnedTotal,input,'seed '+seed+' components');
 }
});

test('AUDIT: 500 randomized complete 2-9 player tournaments preserve engine invariants',{timeout:300000},()=>{
 let hands=0,actions=0,rabbits=0,replays=0,timeouts=0;
 for(let run=1;run<=500;run++){
  const count=2+(run%8),{t,r,total}=singleTable(count,0xABC000+run);t.newHand();assertTableInvariant(t,total,'run '+run+' start');
  for(let handGuard=0;handGuard<700&&t.data.street!=='finished';handGuard++){
   hands++;if(t.data.street==='showdown'){t.newHand();assertTableInvariant(t,total,'run '+run+' transition');continue}
   if(r()<.04&&!t.data.paused&&t.data.street!=='showdown'){try{t.pause(t.data.players.find(p=>p.host));t.resume(t.data.players.find(p=>p.host))}catch{}}
   if(r()<.035){const candidates=t.data.players.filter(p=>!p.eliminated&&p.chips>0&&!p.turn);const q=candidates[int(r,Math.max(1,candidates.length))];if(q)q.sittingOut=true}
   for(let guard=0;guard<1000&&t.data.street!=='showdown'&&t.data.street!=='finished';guard++){
    const before=t.data.message;randomAction(t,r);actions++;if(/timed out/i.test(t.data.message)&&t.data.message!==before)timeouts++;assertTableInvariant(t,total,'run '+run+' action '+guard)
   }
   assert.notEqual(t.data.street,'preflop','run '+run+' hand stalled preflop');assert.notEqual(t.data.street,'flop','run '+run+' hand stalled flop');assert.notEqual(t.data.street,'turn','run '+run+' hand stalled turn');assert.notEqual(t.data.street,'river','run '+run+' hand stalled river');
   if(t.data.street==='showdown'){
    if(t.data.lastResult?.uncontested&&t.data.rabbitCandidate&&r()<.7){const requester=t.data.players.find(p=>!p.eliminated&&p.chips>0)||t.data.players[0];const stacks=t.data.players.map(p=>p.chips),board=[...t.data.board],deck=[...t.data.deck];t.rabbitHunt(requester);rabbits++;assert.deepEqual(t.data.players.map(p=>p.chips),stacks);assert.deepEqual(t.data.board,board);assert.deepEqual(t.data.deck,deck)}
    const muck=(t.data.lastResult?.mucked||[]).find(x=>!x.confirmed);if(muck&&r()<.5){const p=t.data.players.find(x=>x.id===muck.playerId);if(p){if(r()<.5)t.showdownChoice(p,'showhand');else t.showdownChoice(p,'muck')}}
    const h=t.data.handHistory?.[0];if(h?.replay?.steps?.length){const loaded=t.replayHistory(h.handNumber);assert.ok(loaded.replay.steps.length);replays++;const pub=t.public(t.data.players[0].token);assert.equal(pub.handHistory?.[0]?.replay,undefined)}
   }
   for(const p of t.data.players)p.sittingOut=false;assertTableInvariant(t,total,'run '+run+' showdown')
  }
  assert.equal(t.data.street,'finished','run '+run+' did not finish');const alive=t.data.players.filter(p=>p.chips>0&&!p.eliminated);assert.equal(alive.length,1,'run '+run+' one winner');assert.equal(alive[0].chips,total,'run '+run+' winner has all chips');
 }
 console.log('Random STT audit summary',{runs:500,hands,actions,rabbits,replays,timeouts});
});

const MTT_START=2500,MTT_TOTAL=MTT_START*MTT_MAX_PLAYERS,MTT_BLINDS=[[10,20],[25,50],[50,100],[100,200],[200,400],[400,800],[800,1600],[1600,3200],[3200,6400],[6400,12800],[12800,25600],[25600,51200],[51200,102400]];
class MemoryNamespace{constructor(factory){this.factory=factory;this.instances=new Map()}idFromName(name){return String(name)}instance(name){const k=String(name);if(!this.instances.has(k))this.instances.set(k,this.factory(storageState(),k));return this.instances.get(k)}get(name){const object=this.instance(name);return{fetch:req=>object.fetch(req)}}}
function req(url,body){return new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}
async function body(response){const b=await response.json().catch(()=>({}));assert.ok(response.ok,b.error||'HTTP '+response.status);return b}
async function world(run){const env={},tables=new MemoryNamespace(state=>new PokerTable(state,env)),tournaments=new MemoryNamespace(state=>new TournamentCoordinator(state,env));env.TABLES=tables;env.TOURNAMENTS=tournaments;const code='S'+String(run).padStart(5,'0'),coordinator=tournaments.instance(code),players=Array.from({length:MTT_MAX_PLAYERS},(_,i)=>'Bot '+String(i+1).padStart(2,'0')),now=Date.now();await body(await coordinator.fetch(req('https://tournament/init',{code,players,startingChips:MTT_START,blindStructure:MTT_BLINDS,levelDurationMs:1000,now,bigBlindAnte:run%2===0,breaksEnabled:false})));await body(await coordinator.fetch(req('https://tournament/provision',{})));await body(await coordinator.fetch(req('https://tournament/start',{now})));return{tables,coordinator}}
function mttAction(table,p){const current=table.betToMatch(),toCall=table.toCall(p),open=table.raiseIsOpen(p),opp=table.hasRaiseOpponent(p),canAllIn=p.bet+p.chips<=current||(opp&&open);if(canAllIn)return'allin';return toCall>0?'call':'check'}
function playMttHand(table){let n=0;for(let guard=0;guard<700;guard++){const d=table.data;if(!d?.started||d.paused||d.street==='showdown'||d.street==='finished')break;const p=d.players[d.turnIndex];if(!p||p.eliminated||p.folded||p.chips<=0){table.advance();continue}table.act(p,mttAction(table,p),0);n++}assert.ok(table.data.street==='showdown'||table.data.street==='finished','MTT hand stalled');return n}
function mttInvariant(c){const d=c.data,total=d.players.reduce((sum,p)=>sum+p.chips,0),active=d.players.filter(p=>!p.eliminated&&p.chips>0);assert.equal(total,MTT_TOTAL,'MTT chip supply');const ids=new Set();for(const table of d.tables){const seats=new Set();for(const id of table.playerIds){const p=d.players.find(x=>x.id===id);if(!p||p.eliminated||p.chips<=0)continue;assert.equal(p.tableNumber,table.tableNumber);assert.equal(ids.has(id),false,'duplicate table ownership');ids.add(id);assert.equal(seats.has(p.seat),false,'duplicate seat');seats.add(p.seat)}}assert.equal(ids.size,active.length,'all active players owned');const places=d.players.map(p=>p.finishPlace).filter(Number.isInteger);assert.equal(new Set(places).size,places.length,'unique places')}
async function expire(table){if(table.data?.street!=='showdown')return;table.data.phaseDeadline=Date.now()-1;await table.finishMTTBoundary()}
async function pauseResume(c,tables){if(c.data.status!=='running')return;const now=Date.now();await body(await c.fetch(req('https://tournament/pause',{now})));for(const meta of c.data.tables.filter(t=>t.provisioned&&t.status!=='closed'))assert.equal(tables.instance(meta.tableKey).data.paused,true);await body(await c.fetch(req('https://tournament/resume',{now:now+2000})))}

test('AUDIT: 50 complete 50-player MTTs through real child tables + coordinator',{timeout:600000},async()=>{
 let hands=0,actions=0,moves=0,breaks=0,bbaRuns=0;
 for(let run=1;run<=50;run++){
  const{tables,coordinator}=await world(run);if(run%2===0)bbaRuns++;mttInvariant(coordinator);
  for(let cycle=0;cycle<250&&coordinator.data.status!=='finished';cycle++){
   if(cycle===2||cycle===7)await pauseResume(coordinator,tables);
   coordinator.data.clock.levelStartedAt-=1250;
   for(const meta of coordinator.data.tables){if(coordinator.data.status==='finished')break;if(meta.status==='closed')continue;const table=tables.instance(meta.tableKey);await table.load();if(!table.data)continue;
    if(table.data.street==='showdown')await expire(table);else if(table.data.started&&table.data.street!=='finished'){actions+=playMttHand(table);hands++;await expire(table)}
    const pending=(coordinator.data.pendingMoves||[]).filter(m=>!m.acknowledged);moves=Math.max(moves,pending.length);if(pending.some(m=>m.kind==='break'))breaks++;mttInvariant(coordinator)
   }
  }
  assert.equal(coordinator.data.status,'finished','MTT run '+run+' did not finish');mttInvariant(coordinator);const winner=coordinator.data.players.find(p=>p.finishPlace===1);assert.equal(winner?.chips,MTT_TOTAL,'MTT winner owns chip supply');
  assert.deepEqual(coordinator.data.players.map(p=>p.finishPlace).sort((a,b)=>a-b),Array.from({length:MTT_MAX_PLAYERS},(_,i)=>i+1));
 }
 console.log('MTT audit summary',{runs:50,entrants:50*MTT_MAX_PLAYERS,hands,actions,maxPendingMoves:moves,breakMoveObservations:breaks,bbaRuns});
});

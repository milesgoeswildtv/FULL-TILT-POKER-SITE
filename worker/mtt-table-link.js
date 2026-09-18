import{nextBigBlindPlayerId as computeNextBigBlindPlayerId,worstBalanceSeat}from'./positions.js';

export function tournamentStub(env,code){if(!env?.TOURNAMENTS||!code)throw Error('Tournament binding unavailable.');return env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(String(code)))}

async function readJson(response){const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||`Tournament coordinator returned ${response.status}.`);return body}

export async function syncTournamentTable(env,{tournamentCode,tableNumber,atBoundary=true}){
 const suffix=atBoundary?'?atBoundary=1':'',stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/sync${suffix}`));
 return readJson(response);
}

export async function reportTournamentTable(env,{tournamentCode,tableNumber,...report}){
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/report`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report)}));
 return readJson(response);
}

export async function acknowledgeTournamentMoves(env,{tournamentCode,tableNumber,moves,moveIds}){
 const acknowledgements=Array.isArray(moves)?moves:Array.isArray(moveIds)?moveIds.map(id=>({id})):[];
 if(!acknowledgements.length)return syncTournamentTable(env,{tournamentCode,tableNumber,atBoundary:false});
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/ack-moves`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({moves:acknowledgements})}));
 return readJson(response);
}

export function applyTournamentBlinds(tableData,snapshot){
 if(!tableData||!snapshot?.handBlinds)return false;
 const b=snapshot.handBlinds;tableData.blindLevel=Number(b.blindLevel)||0;tableData.smallBlind=Math.max(1,Math.trunc(Number(b.smallBlind)||1));tableData.bigBlind=Math.max(tableData.smallBlind,Math.trunc(Number(b.bigBlind)||tableData.smallBlind));tableData.minRaise=tableData.bigBlind;tableData.tournamentClock=snapshot.clock||null;return true;
}

function nonNegativeInt(v){return Math.max(0,Math.trunc(Number(v)||0))}
function generation(v){return Math.max(1,Math.trunc(Number(v)||1))}
function seatNumber(v){const n=Number(v);return Number.isInteger(n)&&n>=1?n:null}
function cleanStats(stats={}){return{handsPlayed:nonNegativeInt(stats.handsPlayed),handsWon:nonNegativeInt(stats.handsWon),vpipHands:nonNegativeInt(stats.vpipHands),pfrHands:nonNegativeInt(stats.pfrHands),biggestPotWon:nonNegativeInt(stats.biggestPotWon),knockouts:Math.max(0,Number(stats.knockouts)||0),chipsWon:nonNegativeInt(stats.chipsWon)}}
function canonicalId(player){return player?.tournamentPlayerId||player?.id||null}
function freshPlayer(row){const chips=nonNegativeInt(row.chips);return{id:`mtt-${row.id}`,tournamentPlayerId:row.id,ownershipGeneration:generation(row.ownershipGeneration),accountId:String(row.accountId||'')||null,token:String(row.token||''),name:String(row.name||''),chips,bet:0,contributed:0,host:false,testBot:false,cosmetic:String(row.cosmetic||'default'),sittingOut:!!row.sittingOut,folded:false,eliminated:!!row.eliminated||chips<=0,finishPlace:Number.isInteger(row.finishPlace)?row.finishPlace:null,cards:[],stats:cleanStats(row.stats),handStartChips:chips,vpipThisHand:false,pfrThisHand:false,moveCount:nonNegativeInt(row.moveCount),tournamentSeat:seatNumber(row.seat)}}
function resetAtBoundary(player,row){const chips=nonNegativeInt(row.chips);player.tournamentPlayerId=row.id;player.ownershipGeneration=generation(row.ownershipGeneration);player.accountId=String(row.accountId||player.accountId||'')||null;player.token=String(row.token||player.token||'');player.name=String(row.name||player.name||'');player.chips=chips;player.bet=0;player.contributed=0;player.host=false;player.testBot=!!player.testBot;player.cosmetic=String(row.cosmetic||player.cosmetic||'default');player.sittingOut=!!row.sittingOut;player.folded=false;player.eliminated=!!row.eliminated||chips<=0;player.finishPlace=Number.isInteger(row.finishPlace)?row.finishPlace:null;player.cards=[];player.stats=cleanStats(row.stats||player.stats);player.handStartChips=chips;player.vpipThisHand=false;player.pfrThisHand=false;player.moveCount=nonNegativeInt(row.moveCount);player.tournamentSeat=seatNumber(row.seat);return player}

export function reconcileTournamentRoster(tableData,snapshot){
 if(!tableData||!Array.isArray(snapshot?.players))return{added:[],removed:[],acceptedMoveIds:[],acceptedMoves:[]};
 tableData.mttReportGeneration=generation(snapshot.reportGeneration||tableData.mttReportGeneration);
 const original=[...(tableData.players||[])],dealer=original[Number(tableData.dealerIndex)||0]||null,dealerId=canonicalId(dealer),dealerSeat=seatNumber(dealer?.tournamentSeat),moves=Array.isArray(snapshot.moves)?snapshot.moves:[],rows=snapshot.players.map(row=>({...row}));
 for(const move of moves.filter(m=>!m?.acknowledged&&m?.kind==='balance'&&m?.toTable===Number(snapshot.tableNumber)&&m?.toSeat==null)){
  const row=rows.find(r=>r.id===move.playerId&&generation(r.ownershipGeneration)===generation(move.toOwnershipGeneration));if(!row)continue;
  const seat=worstBalanceSeat({players:rows.filter(r=>r.id!==row.id),incomingPlayerId:row.id,dealerPlayerId:dealerId,dealerSeat,capacity:snapshot.capacity||8});if(!seat)throw Error('No legal non-small-blind seat is available for the balancing player.');row.seat=seat;
 }
 const byId=new Map(original.map(p=>[canonicalId(p),p]).filter(([id])=>id)),used=new Set(),added=[],next=[];
 rows.sort((a,b)=>(seatNumber(a.seat)??99)-(seatNumber(b.seat)??99));
 for(const row of rows){let player=byId.get(row.id)||null;if(player&&used.has(player))player=null;if(player){used.add(player);resetAtBoundary(player,row)}else{player=freshPlayer(row);added.push(row.id)}next.push(player)}
 const removed=original.filter(p=>!used.has(p)).map(p=>canonicalId(p)).filter(Boolean);
 tableData.mttMoveNotices??={};
 const seatById=new Map(rows.map(r=>[r.id,seatNumber(r.seat)]));
 for(const move of moves){if(!move?.playerToken)continue;tableData.mttMoveNotices[move.playerToken]={id:move.id,kind:move.kind,fromTable:move.fromTable,toTable:move.toTable,toTableKey:move.toTableKey||null,toSeat:seatById.get(move.playerId)??move.toSeat??null,reason:move.reason||'',createdAt:move.createdAt||Date.now()}}
 tableData.players=next;
 const dealerNow=next.findIndex(p=>canonicalId(p)===dealerId);
 if(dealerNow>=0)tableData.dealerIndex=dealerNow;
 else if(next.length&&dealerSeat){let predecessor=-1,best=-Infinity;for(let i=0;i<next.length;i++){const seat=seatNumber(next[i].tournamentSeat)||0;if(seat<dealerSeat&&seat>best){best=seat;predecessor=i}}tableData.dealerIndex=predecessor>=0?predecessor:next.length-1}
 else tableData.dealerIndex=Math.min(Number(tableData.dealerIndex)||0,Math.max(0,next.length-1));
 const present=new Map(rows.map(r=>[r.id,generation(r.ownershipGeneration)])),acceptedMoves=moves.filter(m=>m?.toTable===Number(snapshot.tableNumber)&&present.get(m.playerId)===generation(m.toOwnershipGeneration)&&m.id).map(m=>({id:m.id,seat:seatById.get(m.playerId)??null})),acceptedMoveIds=acceptedMoves.map(m=>m.id);
 return{added,removed,acceptedMoveIds,acceptedMoves};
}

export function tournamentTableReport(tableData){
 const handNumber=nonNegativeInt(tableData?.handNumber),completedAt=nonNegativeInt(tableData?.lastResult?.finishedAt),players=tableData?.players||[],dealer=players[Number(tableData?.dealerIndex)||0]||null,positionRows=players.map(p=>({id:canonicalId(p),seat:seatNumber(p.tournamentSeat),chips:nonNegativeInt(p.chips),eliminated:!!p.eliminated})),nextBigBlindPlayerId=computeNextBigBlindPlayerId({players:positionRows,dealerPlayerId:canonicalId(dealer),dealerSeat:seatNumber(dealer?.tournamentSeat)})||null;
 return{reportGeneration:generation(tableData?.mttReportGeneration),boundarySequence:handNumber,handNumber,completedAt,status:tableData?.street==='finished'?'finished':tableData?.paused?'paused':'running',nextBigBlindPlayerId,players:players.map(p=>({id:canonicalId(p),ownershipGeneration:generation(p.ownershipGeneration),name:p.name,chips:nonNegativeInt(p.chips),eliminated:!!p.eliminated,finishPlace:Number.isInteger(p.finishPlace)?p.finishPlace:null,handStartChips:nonNegativeInt(p.handStartChips),stats:cleanStats(p.stats),cosmetic:String(p.cosmetic||'default'),sittingOut:!!p.sittingOut}))};
}

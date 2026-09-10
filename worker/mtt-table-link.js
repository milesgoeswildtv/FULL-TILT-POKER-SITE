export function tournamentStub(env,code){if(!env?.TOURNAMENTS||!code)throw Error('Tournament binding unavailable.');return env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(String(code)))}

async function readJson(response){const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||`Tournament coordinator returned ${response.status}.`);return body}

export async function syncTournamentTable(env,{tournamentCode,tableNumber}){
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/sync`));
 return readJson(response);
}

export async function reportTournamentTable(env,{tournamentCode,tableNumber,handNumber,status,players}){
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/report`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handNumber,status,players})}));
 return readJson(response);
}

export async function acknowledgeTournamentMoves(env,{tournamentCode,tableNumber,moveIds}){
 if(!Array.isArray(moveIds)||!moveIds.length)return syncTournamentTable(env,{tournamentCode,tableNumber});
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/ack-moves`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({moveIds})}));
 return readJson(response);
}

export function applyTournamentBlinds(tableData,snapshot){
 if(!tableData||!snapshot?.handBlinds)return false;
 const b=snapshot.handBlinds;tableData.blindLevel=Number(b.blindLevel)||0;tableData.smallBlind=Math.max(1,Math.trunc(Number(b.smallBlind)||1));tableData.bigBlind=Math.max(tableData.smallBlind,Math.trunc(Number(b.bigBlind)||tableData.smallBlind));tableData.minRaise=tableData.bigBlind;tableData.tournamentClock=snapshot.clock||null;return true;
}

function nonNegativeInt(v){return Math.max(0,Math.trunc(Number(v)||0))}
function cleanStats(stats={}){return{handsPlayed:nonNegativeInt(stats.handsPlayed),handsWon:nonNegativeInt(stats.handsWon),vpipHands:nonNegativeInt(stats.vpipHands),pfrHands:nonNegativeInt(stats.pfrHands),biggestPotWon:nonNegativeInt(stats.biggestPotWon),knockouts:nonNegativeInt(stats.knockouts)}}
function canonicalId(player){return player?.tournamentPlayerId||player?.id||null}
function freshPlayer(row){const chips=nonNegativeInt(row.chips);return{id:`mtt-${row.id}`,tournamentPlayerId:row.id,token:String(row.token||''),name:String(row.name||''),chips,bet:0,contributed:0,host:false,testBot:false,cosmetic:String(row.cosmetic||'default'),folded:false,eliminated:!!row.eliminated||chips<=0,finishPlace:Number.isInteger(row.finishPlace)?row.finishPlace:null,cards:[],stats:cleanStats(row.stats),handStartChips:chips,vpipThisHand:false,pfrThisHand:false,moveCount:nonNegativeInt(row.moveCount),tournamentSeat:Number(row.seat)||null}}
function resetAtBoundary(player,row){const chips=nonNegativeInt(row.chips);player.tournamentPlayerId=row.id;player.token=String(row.token||player.token||'');player.name=String(row.name||player.name||'');player.chips=chips;player.bet=0;player.contributed=0;player.host=false;player.testBot=!!player.testBot;player.cosmetic=String(row.cosmetic||player.cosmetic||'default');player.folded=false;player.eliminated=!!row.eliminated||chips<=0;player.finishPlace=Number.isInteger(row.finishPlace)?row.finishPlace:null;player.cards=[];player.stats=cleanStats(row.stats||player.stats);player.handStartChips=chips;player.vpipThisHand=false;player.pfrThisHand=false;player.moveCount=nonNegativeInt(row.moveCount);player.tournamentSeat=Number(row.seat)||null;return player}

export function reconcileTournamentRoster(tableData,snapshot){
 if(!tableData||!Array.isArray(snapshot?.players))return{added:[],removed:[],acceptedMoveIds:[]};
 const original=[...(tableData.players||[])],dealer=original[Number(tableData.dealerIndex)||0]||null,dealerId=canonicalId(dealer),dealerSeat=Number(dealer?.tournamentSeat)||null;
 const byId=new Map(original.map(p=>[canonicalId(p),p]).filter(([id])=>id)),byName=new Map(original.map(p=>[p.name,p])),used=new Set(),added=[],next=[];
 const rows=[...snapshot.players].sort((a,b)=>(Number(a.seat)||99)-(Number(b.seat)||99));
 for(const row of rows){let player=byId.get(row.id)||byName.get(row.name);if(player&&used.has(player))player=null;if(player){used.add(player);resetAtBoundary(player,row)}else{player=freshPlayer(row);added.push(row.id)}next.push(player)}
 const removed=original.filter(p=>!used.has(p)).map(p=>canonicalId(p)).filter(Boolean);
 tableData.mttMoveNotices??={};
 const moves=Array.isArray(snapshot.moves)?snapshot.moves:[];
 for(const move of moves){if(!move?.playerToken)continue;tableData.mttMoveNotices[move.playerToken]={id:move.id,kind:move.kind,fromTable:move.fromTable,toTable:move.toTable,toTableKey:move.toTableKey||null,toSeat:move.toSeat,reason:move.reason||'',createdAt:move.createdAt||Date.now()}}
 tableData.players=next;
 const dealerNow=next.findIndex(p=>canonicalId(p)===dealerId);
 if(dealerNow>=0)tableData.dealerIndex=dealerNow;
 else if(next.length&&dealerSeat){let predecessor=-1,best=-Infinity;for(let i=0;i<next.length;i++){const seat=Number(next[i].tournamentSeat)||0;if(seat<dealerSeat&&seat>best){best=seat;predecessor=i}}tableData.dealerIndex=predecessor>=0?predecessor:next.length-1}
 else tableData.dealerIndex=Math.min(Number(tableData.dealerIndex)||0,Math.max(0,next.length-1));
 const present=new Set(rows.map(r=>r.id)),acceptedMoveIds=moves.filter(m=>m?.toTable===Number(snapshot.tableNumber)&&present.has(m.playerId)&&m.id).map(m=>m.id);
 return{added,removed,acceptedMoveIds};
}

export function tournamentTableReport(tableData){
 return{handNumber:tableData?.handNumber||0,status:tableData?.street==='finished'?'finished':tableData?.paused?'paused':'running',players:(tableData?.players||[]).map(p=>({id:p.tournamentPlayerId||p.id,name:p.name,chips:nonNegativeInt(p.chips),eliminated:!!p.eliminated,finishPlace:Number.isInteger(p.finishPlace)?p.finishPlace:null,handStartChips:nonNegativeInt(p.handStartChips),stats:cleanStats(p.stats),cosmetic:String(p.cosmetic||'default')}))};
}

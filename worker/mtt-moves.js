import{MTT_TABLE_CAPACITY,chooseBalanceMove,shouldBreakTable}from'./mtt.js';
import{secureInt}from'./fairness.js';

function tableCapacity(table){return Math.max(1,Math.trunc(Number(table?.capacity)||MTT_TABLE_CAPACITY))}
function activePlayers(tournament,table){return (table?.playerIds||[]).map(id=>tournament.players.find(p=>p.id===id)).filter(p=>p&&!p.eliminated&&p.chips>0)}
function occupiedSeats(tournament,table){return new Set(activePlayers(tournament,table).map(p=>Number(p.seat)).filter(Number.isInteger))}
function openSeats(tournament,table){const used=occupiedSeats(tournament,table),out=[];for(let seat=1;seat<=tableCapacity(table);seat++)if(!used.has(seat))out.push(seat);return out}
function randomItem(list,randomInt){if(!list.length)return null;return list[randomInt(list.length)]}
function shuffled(list,randomInt){const out=[...list];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
export function activeTournamentTables(tournament){return (tournament?.tables||[]).filter(t=>t.status!=='closed'&&activePlayers(tournament,t).length>0)}
export function movePlayer(tournament,{playerId,fromTable,toTable,toSeat,kind='balance',reason=''}){
 const from=tournament.tables.find(t=>t.tableNumber===Number(fromTable)),to=tournament.tables.find(t=>t.tableNumber===Number(toTable)),player=tournament.players.find(p=>p.id===playerId);
 if(!from||!to||!player||from===to||!from.playerIds.includes(playerId))throw Error('Invalid tournament table move.');
 if(player.reportOwnerTable!=null&&Number(player.reportOwnerTable)!==from.tableNumber)throw Error('Player report ownership does not match move source.');
 const capacity=tableCapacity(to);if(activePlayers(tournament,to).length>=capacity)throw Error('Destination table is full.');
 const deferred=kind==='balance'&&(toSeat==null||toSeat==='');let seat=null;
 if(!deferred){seat=Math.trunc(Number(toSeat)||0);if(!seat||seat<1||seat>capacity)throw Error('Destination seat unavailable.');if(occupiedSeats(tournament,to).has(seat))throw Error('Destination seat is occupied.')}
 const oldGeneration=Math.max(1,Math.trunc(Number(player.ownershipGeneration)||1)),newGeneration=oldGeneration+1;
 from.playerIds=from.playerIds.filter(id=>id!==playerId);if(!to.playerIds.includes(playerId))to.playerIds.push(playerId);
 player.tableNumber=to.tableNumber;player.seat=seat;player.moveCount=Number(player.moveCount||0)+1;player.ownershipGeneration=newGeneration;player.reportOwnerTable=null;
 const move={id:`move-${Date.now()}-${player.id}-${newGeneration}`,kind,playerId:player.id,playerName:player.name,playerToken:player.token||null,fromTable:from.tableNumber,fromTableKey:from.tableKey||null,toTable:to.tableNumber,toTableKey:to.tableKey||null,toSeat:seat,stack:player.chips,fromOwnershipGeneration:oldGeneration,toOwnershipGeneration:newGeneration,reason,createdAt:Date.now(),acknowledged:false};
 player.pendingMoveId=move.id;tournament.pendingMoves??=[];tournament.pendingMoves.push(move);return move;
}
export function planBalanceMove(tournament){
 const tables=activeTournamentTables(tournament).map(t=>({tableNumber:t.tableNumber,nextBigBlindPlayerId:t.nextBigBlindPlayerId||null,players:activePlayers(tournament,t).map(p=>({playerId:p.id,seat:p.seat,moveCount:p.moveCount||0}))}));
 return chooseBalanceMove(tables);
}
function cloneForPlanning(tournament){return{...tournament,players:(tournament.players||[]).map(p=>({...p})),tables:(tournament.tables||[]).map(t=>({...t,playerIds:[...(t.playerIds||[])]})),pendingMoves:[]}}
export function planTableBreak(tournament,{randomInt=secureInt}={}){
 const sim=cloneForPlanning(tournament),tables=activeTournamentTables(sim);if(tables.length<=1)return null;
 const total=tables.reduce((n,t)=>n+activePlayers(sim,t).length,0);if(!shouldBreakTable(total,tables.length))return null;
 const source=[...tables].sort((a,b)=>activePlayers(sim,a).length-activePlayers(sim,b).length||b.tableNumber-a.tableNumber)[0],destinations=tables.filter(t=>t!==source),moving=activePlayers(sim,source);
 const counts=new Map(destinations.map(t=>[t.tableNumber,activePlayers(sim,t).length])),used=new Map(destinations.map(t=>[t.tableNumber,occupiedSeats(sim,t)])),slots=[];
 for(let i=0;i<moving.length;i++){
  const available=destinations.filter(t=>counts.get(t.tableNumber)<tableCapacity(t)),minimum=Math.min(...available.map(t=>counts.get(t.tableNumber))),shortest=available.filter(t=>counts.get(t.tableNumber)===minimum),target=randomItem(shortest,randomInt);if(!target)throw Error('No room to break tournament table.');
  const seats=[];for(let seat=1;seat<=tableCapacity(target);seat++)if(!used.get(target.tableNumber).has(seat))seats.push(seat);const seat=randomItem(seats,randomInt);if(!seat)throw Error('No open destination seat for table break.');used.get(target.tableNumber).add(seat);counts.set(target.tableNumber,counts.get(target.tableNumber)+1);slots.push({toTable:target.tableNumber,toSeat:seat});
 }
 const players=shuffled(moving,randomInt),seatCards=shuffled(slots,randomInt),moves=players.map((player,i)=>({kind:'break',playerId:player.id,fromTable:source.tableNumber,toTable:seatCards[i].toTable,toSeat:seatCards[i].toSeat,reason:`Table ${source.tableNumber} closed as the field condensed.`}));
 return{sourceTable:source.tableNumber,moves};
}
export function nextTournamentMove(tournament){
 const tables=activeTournamentTables(tournament),total=tables.reduce((n,t)=>n+activePlayers(tournament,t).length,0);
 if(shouldBreakTable(total,tables.length))return{kind:'break'};
 const move=planBalanceMove(tournament);return move?{kind:'balance',move}:null;
}

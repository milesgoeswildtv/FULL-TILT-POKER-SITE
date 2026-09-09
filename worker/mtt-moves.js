import{MTT_TABLE_CAPACITY,chooseBalanceMove,shouldBreakTable}from'./mtt.js';

function activePlayers(tournament,table){return table.playerIds.map(id=>tournament.players.find(p=>p.id===id)).filter(p=>p&&!p.eliminated&&p.chips>0)}
function openSeat(tournament,table){const used=new Set(activePlayers(tournament,table).map(p=>p.seat));for(let seat=1;seat<=MTT_TABLE_CAPACITY;seat++)if(!used.has(seat))return seat;return null}
export function activeTournamentTables(tournament){return tournament.tables.filter(t=>activePlayers(tournament,t).length>0)}
export function movePlayer(tournament,{playerId,fromTable,toTable,toSeat,kind='balance',reason=''}){
 const from=tournament.tables.find(t=>t.tableNumber===fromTable),to=tournament.tables.find(t=>t.tableNumber===toTable),player=tournament.players.find(p=>p.id===playerId);
 if(!from||!to||!player||!from.playerIds.includes(playerId))throw Error('Invalid tournament table move.');
 if(activePlayers(tournament,to).length>=MTT_TABLE_CAPACITY)throw Error('Destination table is full.');
 const seat=toSeat||openSeat(tournament,to);if(!seat)throw Error('Destination seat unavailable.');
 from.playerIds=from.playerIds.filter(id=>id!==playerId);if(!to.playerIds.includes(playerId))to.playerIds.push(playerId);
 player.tableNumber=to.tableNumber;player.seat=seat;player.moveCount=Number(player.moveCount||0)+1;
 const move={id:`move-${Date.now()}-${player.id}`,kind,playerId:player.id,playerName:player.name,fromTable:from.tableNumber,toTable:to.tableNumber,toSeat:seat,stack:player.chips,reason,createdAt:Date.now(),acknowledged:false};
 tournament.pendingMoves??=[];tournament.pendingMoves.push(move);return move;
}
export function planBalanceMove(tournament){
 const tables=activeTournamentTables(tournament).map(t=>({tableNumber:t.tableNumber,players:activePlayers(tournament,t).map(p=>({playerId:p.id,seat:p.seat,moveCount:p.moveCount||0,sittingOut:!!p.sittingOut}))}));
 return chooseBalanceMove(tables);
}
export function planTableBreak(tournament){
 const tables=activeTournamentTables(tournament);if(tables.length<=1)return null;
 const total=tables.reduce((n,t)=>n+activePlayers(tournament,t).length,0);if(!shouldBreakTable(total,tables.length))return null;
 const source=[...tables].sort((a,b)=>activePlayers(tournament,a).length-activePlayers(tournament,b).length||b.tableNumber-a.tableNumber)[0];
 const destinations=tables.filter(t=>t!==source).sort((a,b)=>activePlayers(tournament,a).length-activePlayers(tournament,b).length||a.tableNumber-b.tableNumber);
 const moves=[];for(const player of activePlayers(tournament,source).sort((a,b)=>(a.moveCount||0)-(b.moveCount||0)||a.seat-b.seat)){
  const target=destinations.filter(t=>activePlayers(tournament,t).length<mttCapacity(t)).sort((a,b)=>activePlayers(tournament,a).length-activePlayers(tournament,b).length||a.tableNumber-b.tableNumber)[0];if(!target)throw Error('No room to break tournament table.');
  moves.push({kind:'break',playerId:player.id,fromTable:source.tableNumber,toTable:target.tableNumber,toSeat:openSeat(tournament,target),reason:`Table ${source.tableNumber} closed as the field condensed.`});
  target.playerIds.push(player.id);source.playerIds=source.playerIds.filter(id=>id!==player.id);player.tableNumber=target.tableNumber;player.seat=moves.at(-1).toSeat;
 }
 // Planning mutates temporary seating above so restore by applying caller on a cloned tournament only.
 return{sourceTable:source.tableNumber,moves};
}
function mttCapacity(table){return Number(table.capacity)||MTT_TABLE_CAPACITY}
export function nextTournamentMove(tournament){
 const tables=activeTournamentTables(tournament),total=tables.reduce((n,t)=>n+activePlayers(tournament,t).length,0);
 if(shouldBreakTable(total,tables.length))return{kind:'break'};
 const move=planBalanceMove(tournament);return move?{kind:'balance',move}:null;
}

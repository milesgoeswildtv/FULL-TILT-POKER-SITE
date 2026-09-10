import{MTT_TABLE_CAPACITY,chooseBalanceMove,shouldBreakTable}from'./mtt.js';

function tableCapacity(table){return Math.max(1,Math.trunc(Number(table?.capacity)||MTT_TABLE_CAPACITY))}
function activePlayers(tournament,table){return (table?.playerIds||[]).map(id=>tournament.players.find(p=>p.id===id)).filter(p=>p&&!p.eliminated&&p.chips>0)}
function openSeat(tournament,table){const used=new Set(activePlayers(tournament,table).map(p=>Number(p.seat)));for(let seat=1;seat<=tableCapacity(table);seat++)if(!used.has(seat))return seat;return null}
export function activeTournamentTables(tournament){return (tournament?.tables||[]).filter(t=>t.status!=='closed'&&activePlayers(tournament,t).length>0)}
export function movePlayer(tournament,{playerId,fromTable,toTable,toSeat,kind='balance',reason=''}){ 
 const from=tournament.tables.find(t=>t.tableNumber===Number(fromTable)),to=tournament.tables.find(t=>t.tableNumber===Number(toTable)),player=tournament.players.find(p=>p.id===playerId);
 if(!from||!to||!player||from===to||!from.playerIds.includes(playerId))throw Error('Invalid tournament table move.');
 const capacity=tableCapacity(to);if(activePlayers(tournament,to).length>=capacity)throw Error('Destination table is full.');
 const requested=Math.trunc(Number(toSeat)||0),seat=requested||openSeat(tournament,to);if(!seat||seat<1||seat>capacity)throw Error('Destination seat unavailable.');
 if(activePlayers(tournament,to).some(p=>Number(p.seat)===seat))throw Error('Destination seat is occupied.');
 from.playerIds=from.playerIds.filter(id=>id!==playerId);if(!to.playerIds.includes(playerId))to.playerIds.push(playerId);
 player.tableNumber=to.tableNumber;player.seat=seat;player.moveCount=Number(player.moveCount||0)+1;
 const move={id:`move-${Date.now()}-${player.id}`,kind,playerId:player.id,playerName:player.name,playerToken:player.token||null,fromTable:from.tableNumber,fromTableKey:from.tableKey||null,toTable:to.tableNumber,toTableKey:to.tableKey||null,toSeat:seat,stack:player.chips,reason,createdAt:Date.now(),acknowledged:false};
 tournament.pendingMoves??=[];tournament.pendingMoves.push(move);return move;
}
export function planBalanceMove(tournament){
 const tables=activeTournamentTables(tournament).map(t=>({tableNumber:t.tableNumber,players:activePlayers(tournament,t).map(p=>({playerId:p.id,seat:p.seat,moveCount:p.moveCount||0,sittingOut:!!p.sittingOut}))}));
 return chooseBalanceMove(tables);
}
function cloneForPlanning(tournament){return{...tournament,players:(tournament.players||[]).map(p=>({...p})),tables:(tournament.tables||[]).map(t=>({...t,playerIds:[...(t.playerIds||[])]})),pendingMoves:[]}}
export function planTableBreak(tournament){
 const sim=cloneForPlanning(tournament),tables=activeTournamentTables(sim);if(tables.length<=1)return null;
 const total=tables.reduce((n,t)=>n+activePlayers(sim,t).length,0);if(!shouldBreakTable(total,tables.length))return null;
 const source=[...tables].sort((a,b)=>activePlayers(sim,a).length-activePlayers(sim,b).length||b.tableNumber-a.tableNumber)[0];
 const destinations=tables.filter(t=>t!==source);const moving=[...activePlayers(sim,source)].sort((a,b)=>(a.moveCount||0)-(b.moveCount||0)||a.seat-b.seat),moves=[];
 for(const player of moving){
  const target=destinations.filter(t=>activePlayers(sim,t).length<tableCapacity(t)).sort((a,b)=>activePlayers(sim,a).length-activePlayers(sim,b).length||a.tableNumber-b.tableNumber)[0];if(!target)throw Error('No room to break tournament table.');
  const spec={kind:'break',playerId:player.id,fromTable:source.tableNumber,toTable:target.tableNumber,toSeat:openSeat(sim,target),reason:`Table ${source.tableNumber} closed as the field condensed.`};
  moves.push(spec);movePlayer(sim,spec);
 }
 return{sourceTable:source.tableNumber,moves};
}
export function nextTournamentMove(tournament){
 const tables=activeTournamentTables(tournament),total=tables.reduce((n,t)=>n+activePlayers(tournament,t).length,0);
 if(shouldBreakTable(total,tables.length))return{kind:'break'};
 const move=planBalanceMove(tournament);return move?{kind:'balance',move}:null;
}

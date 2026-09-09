export const MTT_MAX_PLAYERS=50;
export const MTT_TABLE_CAPACITY=8;
export const MTT_MAX_TABLES=10;

export function tableCountForPlayers(playerCount,{capacity=MTT_TABLE_CAPACITY,maxTables=MTT_MAX_TABLES}={}){
 const n=Math.max(0,Math.trunc(Number(playerCount)||0));
 if(!n)return 0;
 return Math.min(maxTables,Math.ceil(n/capacity));
}

export function balancedTableSizes(playerCount,{capacity=MTT_TABLE_CAPACITY,maxTables=MTT_MAX_TABLES}={}){
 const n=Math.max(0,Math.trunc(Number(playerCount)||0)),tables=tableCountForPlayers(n,{capacity,maxTables});
 if(!tables)return[];
 if(n>capacity*maxTables)throw Error('Tournament exceeds table capacity.');
 const base=Math.floor(n/tables),extra=n%tables;
 return Array.from({length:tables},(_,i)=>base+(i<extra?1:0));
}

export function initialAssignments(players,options={}){
 const list=[...players];
 if(list.length>MTT_MAX_PLAYERS)throw Error(`Tournament is capped at ${MTT_MAX_PLAYERS} players.`);
 const sizes=balancedTableSizes(list.length,options),assignments=[],tables=sizes.map((size,i)=>({tableNumber:i+1,capacity:options.capacity||MTT_TABLE_CAPACITY,players:[]}));
 let cursor=0;
 for(let t=0;t<tables.length;t++)for(let seat=1;seat<=sizes[t];seat++){
  const player=list[cursor++],assignment={playerId:player.id,tableNumber:t+1,seat,moveCount:Number(player.moveCount||0)};
  assignments.push(assignment);tables[t].players.push(assignment);
 }
 return{tables,assignments};
}

export function needsRebalance(tableSizes){
 if(!tableSizes?.length)return false;
 return Math.max(...tableSizes)-Math.min(...tableSizes)>1;
}

export function shouldBreakTable(activePlayers,currentTableCount,{capacity=MTT_TABLE_CAPACITY}={}){
 const n=Math.max(0,Math.trunc(Number(activePlayers)||0)),current=Math.max(0,Math.trunc(Number(currentTableCount)||0));
 return current>1&&n<=capacity*(current-1);
}

export function targetTableSizes(activePlayers,currentTableCount,{capacity=MTT_TABLE_CAPACITY}={}){
 const n=Math.max(0,Math.trunc(Number(activePlayers)||0));
 let count=Math.max(0,Math.trunc(Number(currentTableCount)||0));
 while(count>1&&shouldBreakTable(n,count,{capacity}))count--;
 if(!count)return[];
 const base=Math.floor(n/count),extra=n%count;
 return Array.from({length:count},(_,i)=>base+(i<extra?1:0));
}

export function chooseBalanceMove(tables){
 if(!Array.isArray(tables)||tables.length<2)return null;
 const ordered=[...tables].sort((a,b)=>b.players.length-a.players.length||a.tableNumber-b.tableNumber),from=ordered[0],to=ordered.at(-1);
 if(from.players.length-to.players.length<=1)return null;
 const candidates=[...from.players].sort((a,b)=>(Number(a.moveCount||0)-Number(b.moveCount||0))||(Number(!!b.sittingOut)-Number(!!a.sittingOut))||(a.seat-b.seat));
 const player=candidates[0];if(!player)return null;
 const used=new Set(to.players.map(p=>p.seat));let seat=1;while(used.has(seat)&&seat<=MTT_TABLE_CAPACITY)seat++;
 return{kind:'balance',playerId:player.playerId,fromTable:from.tableNumber,toTable:to.tableNumber,toSeat:seat,reason:'Keep active tables as even as possible.'};
}

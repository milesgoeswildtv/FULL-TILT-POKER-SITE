export function tournamentTableKey(code,tableNumber){
 const c=String(code||'').trim().toUpperCase(),n=Math.max(1,Math.trunc(Number(tableNumber)||1));
 if(!c)throw Error('Tournament code required.');
 return`${c}-T${n}`;
}

export function childTablePayload(tournament,table){
 if(!tournament||!table)throw Error('Tournament and table required.');
 const players=table.playerIds.map(id=>tournament.players.find(p=>p.id===id)).filter(Boolean).sort((a,b)=>a.seat-b.seat);
 if(!players.length)throw Error('Cannot provision an empty tournament table.');
 return{code:tournamentTableKey(tournament.code,table.tableNumber),tournamentCode:tournament.code,tournamentTableNumber:table.tableNumber,startingChips:tournament.startingChips,blindStructure:tournament.clock.blindStructure,blindMinutes:tournament.clock.levelDurationMs/60000,players:players.map(p=>({tournamentPlayerId:p.id,token:p.token,name:p.name,chips:p.chips,seat:p.seat,moveCount:p.moveCount||0}))};
}

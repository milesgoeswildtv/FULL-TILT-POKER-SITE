export function headsUpPositions({dealerIndex,nextIndex}){
 const smallBlind=dealerIndex;
 const bigBlind=nextIndex(smallBlind);
 return{smallBlind,bigBlind,preflopFirst:dealerIndex,postflopFirst:bigBlind};
}

export function ringPositions({dealerIndex,nextIndex}){
 const smallBlind=nextIndex(dealerIndex);
 const bigBlind=nextIndex(smallBlind);
 return{smallBlind,bigBlind,preflopFirst:nextIndex(bigBlind),postflopFirst:nextIndex(dealerIndex)};
}

export function handPositions({aliveCount,dealerIndex,nextIndex}){
 if(aliveCount<2)throw Error('At least two active players are required.');
 return aliveCount===2?headsUpPositions({dealerIndex,nextIndex}):ringPositions({dealerIndex,nextIndex});
}

function activeRows(players){return(players||[]).filter(p=>!p.eliminated&&Number(p.chips)>0).sort((a,b)=>Number(a.seat)-Number(b.seat))}
function currentDealerIndex(rows,dealerPlayerId,dealerSeat){
 if(!rows.length)return-1;
 const exact=rows.findIndex(p=>p.id===dealerPlayerId);if(exact>=0)return exact;
 const seat=Number(dealerSeat);if(Number.isFinite(seat)){let predecessor=-1,best=-Infinity;for(let i=0;i<rows.length;i++){const s=Number(rows[i].seat);if(s<seat&&s>best){best=s;predecessor=i}}if(predecessor>=0)return predecessor}
 return rows.length-1;
}

export function nextHandSeatPositions({players,dealerPlayerId,dealerSeat}){
 const rows=activeRows(players);if(rows.length<2)return null;
 const current=currentDealerIndex(rows,dealerPlayerId,dealerSeat),dealer=(current+1)%rows.length;
 const smallBlind=rows.length===2?dealer:(dealer+1)%rows.length,bigBlind=rows.length===2?(dealer+1)%rows.length:(dealer+2)%rows.length;
 return{rows,dealerIndex:dealer,smallBlindIndex:smallBlind,bigBlindIndex:bigBlind,dealerPlayerId:rows[dealer].id,smallBlindPlayerId:rows[smallBlind].id,bigBlindPlayerId:rows[bigBlind].id};
}

export function nextBigBlindPlayerId({players,dealerPlayerId,dealerSeat}){return nextHandSeatPositions({players,dealerPlayerId,dealerSeat})?.bigBlindPlayerId||null}

export function worstBalanceSeat({players,incomingPlayerId,dealerPlayerId,dealerSeat,capacity}){
 const cap=Math.max(2,Math.trunc(Number(capacity)||0)),existing=activeRows(players).filter(p=>p.id!==incomingPlayerId),used=new Set(existing.map(p=>Number(p.seat))),candidates=[];
 for(let seat=1;seat<=cap;seat++)if(!used.has(seat)){
  const roster=[...existing,{id:incomingPlayerId,seat,chips:1,eliminated:false}],pos=nextHandSeatPositions({players:roster,dealerPlayerId,dealerSeat});if(!pos)continue;
  const incomingIndex=pos.rows.findIndex(p=>p.id===incomingPlayerId);if(incomingIndex===pos.smallBlindIndex)continue;
  const handsUntilBigBlind=(incomingIndex-pos.bigBlindIndex+pos.rows.length)%pos.rows.length;candidates.push({seat,handsUntilBigBlind});
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>a.handsUntilBigBlind-b.handsUntilBigBlind||a.seat-b.seat);return candidates[0].seat;
}

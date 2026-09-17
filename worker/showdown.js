import{settleContributions,applySettlement,settlementReturnList}from'./settlement.js';

function summaryFor(pots,returns){const parts=pots.map((p,i)=>`${pots.length>1?`Pot ${i+1}: `:''}${p.winners.join(' & ')} won ${p.amount.toLocaleString()}`);for(const r of returns)parts.push(`${r.name} had ${r.amount.toLocaleString()} uncalled returned`);return parts.join(' • ')}

export function settleShowdown({players,board,dealerIndex,pot,livePot,fairness}){
 const expected=livePot??pot,{pots,awards,returns,total,contestedTotal,returnedTotal}=settleContributions(players,board,dealerIndex);
 if(total!==expected)throw Error(`Pot accounting invariant failed: settled ${total}, live pot ${expected}.`);
 if(livePot!==undefined){
  applySettlement(players,{awards,returns});
  const returnList=settlementReturnList(players,returns);
  return{summary:summaryFor(pots,returnList),board:[...board],revealed:players.filter(p=>!p.folded&&p.contributed>0).map(p=>({playerId:p.id,name:p.name,cards:[...p.cards]})),pots,returns:returnList,settledPot:total,contestedPot:contestedTotal,returnedTotal,fairness};
 }
 return{pots,awards,returns,total,contestedTotal,returnedTotal};
}

export function revealedPlayerIds(lastResult){return new Set((lastResult?.revealed||[]).map(r=>r.playerId).filter(Boolean))}

export function visibleCards({player,viewerToken,street,lastResult}){
 if(player.token===viewerToken)return[...(player.cards||[])];
 if(street!=='showdown'||!player.cards?.length)return player.cards?.length?['','']:[];
 return revealedPlayerIds(lastResult).has(player.id)?[...player.cards]:['',''];
}

export function cardsForViewer({player,viewerToken,street,revealed}){
 return visibleCards({player,viewerToken,street,lastResult:{revealed:revealed||[]}});
}

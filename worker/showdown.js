import{settleSidePots}from'./pots.js';

export function settleShowdown({players,board,dealerIndex,pot,livePot,fairness}){
 const expected=livePot??pot;
 const{pots,awards,total}=settleSidePots(players,board,dealerIndex);
 if(total!==expected)throw Error(`Pot accounting invariant failed: settled ${total}, live pot ${expected}.`);
 if(livePot!==undefined){
  for(const[playerId,amount]of awards){const player=players.find(p=>p.id===playerId);if(!player)throw Error('Pot winner missing from table.');player.chips+=amount}
  return{summary:pots.map((p,i)=>`${pots.length>1?`Pot ${i+1}: `:''}${p.winners.join(' & ')} won ${p.amount.toLocaleString()}`).join(' • '),board:[...board],revealed:players.filter(p=>!p.folded&&p.contributed>0).map(p=>({playerId:p.id,name:p.name,cards:[...p.cards]})),pots,fairness};
 }
 return{pots,awards,total};
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

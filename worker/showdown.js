import{settleSidePots}from'./pots.js';
export function settleShowdown({players,board,dealerIndex,pot}){
 const{pots,awards,total}=settleSidePots(players,board,dealerIndex);
 if(total!==pot)throw Error(`Pot accounting invariant failed: settled ${total}, live pot ${pot}.`);
 return{pots,awards,total};
}
export function revealedPlayerIds(lastResult){return new Set((lastResult?.revealed||[]).map(r=>r.playerId).filter(Boolean))}
export function visibleCards({player,viewerToken,street,lastResult}){
 if(player.token===viewerToken)return[...(player.cards||[])];
 if(street!=='showdown'||!player.cards?.length)return player.cards?.length?['','']:[];
 const ids=revealedPlayerIds(lastResult);return ids.has(player.id)?[...player.cards]:['',''];
}

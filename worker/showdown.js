import{settleContributions,applySettlement,settlementReturnList}from'./settlement.js';

function summaryFor(pots,returns){const parts=pots.map((p,i)=>`${pots.length>1?`Pot ${i+1}: `:''}${p.winners.join(' & ')} won ${p.amount.toLocaleString()}`);for(const r of returns)parts.push(`${r.name} had ${r.amount.toLocaleString()} uncalled returned`);return parts.join(' • ')}

export function showdownPresentation(players=[],pots=[]){
 const live=players.filter(p=>!p.folded&&Number(p.contributed)>0&&Array.isArray(p.cards)&&p.cards.length===2),mustShow=new Set();
 for(const pot of pots||[])for(const id of pot?.winnerIds||[])mustShow.add(String(id));
 for(const p of live)if(Number(p.chips||0)===0)mustShow.add(String(p.id));
 const revealed=[],mucked=[];
 for(const p of live){
  if(mustShow.has(String(p.id)))revealed.push({playerId:p.id,name:p.name,cards:[...p.cards],reason:Number(p.chips||0)===0?'allin':'winner'});
  else mucked.push({playerId:p.id,name:p.name,confirmed:false});
 }
 return{revealed,mucked};
}

export function revealMuckedHand(lastResult,player){
 if(!lastResult||!player||!Array.isArray(player.cards)||player.cards.length!==2||player.folded)return false;
 lastResult.revealed??=[];lastResult.mucked??=[];
 if(lastResult.revealed.some(r=>r.playerId===player.id))return false;
 const index=lastResult.mucked.findIndex(r=>r.playerId===player.id);
 if(index<0)return false;
 lastResult.mucked.splice(index,1);
 lastResult.revealed.push({playerId:player.id,name:player.name,cards:[...player.cards],reason:'voluntary'});
 return true;
}

export function confirmMuck(lastResult,player){
 if(!lastResult||!player)return false;
 const entry=(lastResult.mucked||[]).find(r=>r.playerId===player.id);
 if(!entry)return false;
 if(entry.confirmed)return false;
 entry.confirmed=true;return true;
}

export function settleShowdown({players,board,dealerIndex,pot,livePot,fairness}){
 const expected=livePot??pot,{pots,awards,returns,total,contestedTotal,returnedTotal}=settleContributions(players,board,dealerIndex);
 if(total!==expected)throw Error(`Pot accounting invariant failed: settled ${total}, live pot ${expected}.`);
 if(livePot!==undefined){
  const presentation=showdownPresentation(players,pots);
  applySettlement(players,{awards,returns});
  const returnList=settlementReturnList(players,returns);
  return{summary:summaryFor(pots,returnList),board:[...board],...presentation,pots,returns:returnList,settledPot:total,contestedPot:contestedTotal,returnedTotal,fairness};
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

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

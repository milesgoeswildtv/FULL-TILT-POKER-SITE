import{evaluate,compare}from'./poker-eval.js';

function add(map,key,amount){if(amount>0)map.set(key,(map.get(key)||0)+amount)}
function sumMap(map){let total=0;for(const amount of map.values())total+=amount;return total}
function distanceLeftOfDealer(player,players,dealerIndex){const n=players.length,index=players.indexOf(player),distance=(index-dealerIndex+n)%n;return distance===0?n:distance}

export function settleContributions(players,board=[],dealerIndex=0){
 const contributors=players.filter(p=>Number(p.contributed)>0),levels=[...new Set(contributors.map(p=>Number(p.contributed)))].sort((a,b)=>a-b),scores=new Map(),pots=[],awards=new Map(),returns=new Map();
 let previous=0,contestedTotal=0,returnedTotal=0;
 for(const level of levels){
  const participants=contributors.filter(p=>Number(p.contributed)>=level),amount=(level-previous)*participants.length;previous=level;if(amount<=0)continue;
  if(participants.length===1){add(returns,participants[0].id,amount);returnedTotal+=amount;continue}
  const eligible=participants.filter(p=>!p.folded);if(!eligible.length)throw Error('Pot has no eligible winner.');
  let winners;
  if(eligible.length===1)winners=eligible;
  else{
   let best=null;winners=[];
   for(const p of eligible){let score=scores.get(p.id);if(!score){score=evaluate([...(p.cards||[]),...board]);scores.set(p.id,score)}if(!best||compare(score,best)>0){best=score;winners=[p]}else if(compare(score,best)===0)winners.push(p)}
  }
  const order=[...winners].sort((a,b)=>distanceLeftOfDealer(a,players,dealerIndex)-distanceLeftOfDealer(b,players,dealerIndex)),share=Math.floor(amount/order.length),remainder=amount-share*order.length;
  order.forEach((p,i)=>add(awards,p.id,share+(i<remainder?1:0)));
  contestedTotal+=amount;pots.push({amount,winners:order.map(p=>p.name),winnerIds:order.map(p=>p.id),participantIds:participants.map(p=>p.id)});
 }
 const contributed=contributors.reduce((total,p)=>total+Number(p.contributed||0),0),total=contestedTotal+returnedTotal;
 if(total!==contributed)throw Error(`Pot accounting invariant failed: settled ${total}, contributed ${contributed}.`);
 if(sumMap(awards)!==contestedTotal)throw Error(`Pot accounting invariant failed: awarded ${sumMap(awards)}, contested ${contestedTotal}.`);
 if(sumMap(returns)!==returnedTotal)throw Error(`Pot accounting invariant failed: returned ${sumMap(returns)}, expected ${returnedTotal}.`);
 return{pots,awards,returns,total,contestedTotal,returnedTotal};
}

export function applySettlement(players,{awards=new Map(),returns=new Map()}){
 for(const [playerId,amount]of [...awards,...returns]){const player=players.find(p=>p.id===playerId);if(!player)throw Error('Settlement recipient missing from table.');player.chips+=amount}
}

export function settlementReturnList(players,returns=new Map()){return[...returns].map(([playerId,amount])=>({playerId,amount,name:players.find(p=>p.id===playerId)?.name||''}))}

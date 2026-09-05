import{evaluate,compare}from'./poker-eval.js';
export function settleSidePots(players,board,dealerIndex=0){
 const contributors=players.filter(p=>p.contributed>0),levels=[...new Set(contributors.map(p=>p.contributed))].sort((a,b)=>a-b),scores=new Map(),pots=[],awards=new Map();
 for(const p of players.filter(p=>!p.folded&&p.contributed>0))scores.set(p.id,evaluate([...p.cards,...board]));
 let prev=0,total=0;
 for(const level of levels){
  const participants=contributors.filter(p=>p.contributed>=level),amount=(level-prev)*participants.length;prev=level;if(amount<=0)continue;
  const eligible=participants.filter(p=>!p.folded);if(!eligible.length)throw Error('Pot has no eligible winner.');
  let best=null,winners=[];
  for(const p of eligible){const score=scores.get(p.id);if(!best||compare(score,best)>0){best=score;winners=[p]}else if(compare(score,best)===0)winners.push(p)}
  const share=Math.floor(amount/winners.length),rem=amount-share*winners.length;
  const order=[...winners].sort((a,b)=>((players.indexOf(a)-dealerIndex+players.length)%players.length)-((players.indexOf(b)-dealerIndex+players.length)%players.length));
  order.forEach((p,i)=>awards.set(p.id,(awards.get(p.id)||0)+share+(i<rem?1:0)));
  total+=amount;pots.push({amount,winners:winners.map(p=>p.name),winnerIds:winners.map(p=>p.id),participantIds:participants.map(p=>p.id)});
 }
 const contributed=contributors.reduce((n,p)=>n+p.contributed,0);
 if(total!==contributed)throw Error(`Pot accounting invariant failed: allocated ${total}, contributed ${contributed}.`);
 return{pots,awards,total};
}

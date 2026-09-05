export const RANKS='23456789TJQKA';

export function evaluate(cards){
  const rs=cards.map(c=>RANKS.indexOf(c[0])+2).sort((a,b)=>b-a),suits={};
  for(const c of cards)(suits[c[1]]??=[]).push(RANKS.indexOf(c[0])+2);
  const counts={};rs.forEach(r=>counts[r]=(counts[r]||0)+1);
  const uniq=[...new Set(rs)];if(uniq.includes(14))uniq.push(1);
  let straight=0;
  for(let i=0;i<=uniq.length-5;i++)if(uniq.slice(i,i+5).every((v,j,a)=>j===0||a[j-1]-v===1)){straight=uniq[i];break}
  let flush=[];
  for(const a of Object.values(suits))if(a.length>=5)flush=a.sort((a,b)=>b-a);
  if(flush.length){
    const u=[...new Set(flush)];if(u.includes(14))u.push(1);
    for(let i=0;i<=u.length-5;i++)if(u.slice(i,i+5).every((v,j,a)=>j===0||a[j-1]-v===1))return[8,u[i]];
  }
  const groups=Object.entries(counts).map(([r,c])=>[c,+r]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
  if(groups[0][0]===4)return[7,groups[0][1],...rs.filter(r=>r!==groups[0][1]).slice(0,1)];
  const trips=groups.filter(g=>g[0]>=3),pairs=groups.filter(g=>g[0]>=2);
  if(trips.length&&pairs.some(g=>g[1]!==trips[0][1]))return[6,trips[0][1],pairs.find(g=>g[1]!==trips[0][1])[1]];
  if(flush.length)return[5,...flush.slice(0,5)];
  if(straight)return[4,straight];
  if(trips.length)return[3,trips[0][1],...rs.filter(r=>r!==trips[0][1]).slice(0,2)];
  if(pairs.length>=2){const a=pairs[0][1],b=pairs[1][1];return[2,a,b,...rs.filter(r=>r!==a&&r!==b).slice(0,1)]}
  if(pairs.length)return[1,pairs[0][1],...rs.filter(r=>r!==pairs[0][1]).slice(0,3)];
  return[0,...uniq.filter(x=>x!==1).slice(0,5)];
}

export function compare(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const d=(a[i]||0)-(b[i]||0);if(d)return d;
  }
  return 0;
}

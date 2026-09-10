function n(v){return Math.max(0,Number(v)||0)}
function pct(v,d){return d?Math.round(n(v)/n(d)*1000)/10:0}
export function globalTournamentStats(tournament){
 const players=Array.isArray(tournament?.players)?tournament.players:[],finished=tournament?.status==='finished';
 return players.map(p=>{const stats=p.stats||{},hands=n(stats.handsPlayed);return{...p,chips:n(p.chips),stats:{handsPlayed:hands,handsWon:n(stats.handsWon),vpipHands:n(stats.vpipHands),pfrHands:n(stats.pfrHands),vpip:pct(stats.vpipHands,hands),pfr:pct(stats.pfrHands,hands),biggestPotWon:n(stats.biggestPotWon),knockouts:n(stats.knockouts)}}}).sort((a,b)=>{
  if(finished)return (Number(a.finishPlace)||999)-(Number(b.finishPlace)||999)||b.chips-a.chips||a.name.localeCompare(b.name);
  const aliveA=!a.eliminated&&a.chips>0,aliveB=!b.eliminated&&b.chips>0;if(aliveA!==aliveB)return aliveA?-1:1;
  if(aliveA)return b.chips-a.chips||a.name.localeCompare(b.name);
  return (Number(a.finishPlace)||999)-(Number(b.finishPlace)||999)||a.name.localeCompare(b.name);
 });
}
export function tournamentWinner(tournament){return globalTournamentStats(tournament).find(p=>Number(p.finishPlace)===1)||globalTournamentStats(tournament).find(p=>!p.eliminated&&p.chips>0)||null}
export function tournamentScreen(tournament,session){if(!tournament||!session)return'play';if(tournament.status==='finished')return'finished';if(tournament.status==='ended')return'ended';if(session.eliminated)return'eliminated';return'play'}

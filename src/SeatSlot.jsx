import React from'react';
import{Card,ordinal}from'./TablePanels.jsx';
import{plaqueFor,avatarFrameFor,chipFor,cardBackFor}from'./assets.js';

function seatGeometry(index,players,me){
  const n=Math.max(1,players.length),hero=Math.max(0,me?players.findIndex(p=>p.id===me.id):0),rel=(index-hero+n)%n,theta=(90+rel*(360/n))*Math.PI/180,dx=Math.cos(theta),dy=Math.sin(theta),ring={1:[0,0,0,0],2:[34,33,44,42],3:[36,34,44.5,42.5],4:[38,35,45,43],5:[40,36,45.5,43.5],6:[41.5,37,46,44],7:[42.5,38,46.25,44.25],8:[43,38.5,46.5,44.5],9:[43.5,39,46.5,44.5]}[Math.min(9,n)]||[43.5,39,46.5,44.5],desktopSeatX=50+ring[0]*dx,desktopSeatY=50+ring[1]*dy,mobileSeatX=50+ring[2]*dx,mobileSeatY=50+ring[3]*dy;
  return{'--seat-x':`${desktopSeatX.toFixed(2)}%`,'--seat-y':`${desktopSeatY.toFixed(2)}%`,'--mobile-seat-x':`${mobileSeatX.toFixed(2)}%`,'--mobile-seat-y':`${mobileSeatY.toFixed(2)}%`,'--seat-dx':dx.toFixed(3),'--seat-dy':dy.toFixed(3),'--seat-rel':rel};
}

export default function SeatSlot({player,index,players,me,pos,turnLeft,isShowdown,winners,finished,onKick,state}){
  const geo=seatGeometry(index,players,me),won=winners.has(player.id),showdownLoser=isShowdown&&player.cards?.some(Boolean)&&!won,allIn=player.chips===0&&!player.eliminated&&state.started,backAsset=cardBackFor(player),showCards=state.started&&!player.eliminated&&me?.id!==player.id,cardValues=isShowdown&&Array.isArray(player.cards)&&player.cards.some(Boolean)?player.cards.slice(0,2):['',''],initials=player.testBot?'BOT':player.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),style={...geo,'--plaque-art':`url(${plaqueFor(player)})`,'--avatar-frame':`url(${avatarFrameFor(player)})`};
  return <div style={style} data-seat-index={index} data-seat-rel={geo['--seat-rel']} data-player-id={player.id} data-cosmetic={player.cosmetic||'default'} className={`seatSlot v2SeatSlot seatSlot${index} ${me?.id===player.id?'heroSlot':''} ${player.turn?'turnSlot':''} ${player.folded?'foldedSlot':''} ${player.eliminated?'outSlot':''} ${allIn?'allInSlot':''} ${won?'winnerSlot':''} ${showdownLoser?'loserSlot':''}`}>
    <div className={`seat seatPlate productionSeat seat${index} ${me?.id===player.id?'heroSeat':''} ${player.turn?'turn':''} ${player.folded?'folded':''} ${player.eliminated?'out':''} ${allIn?'allInSeat':''} ${won?'showdownWinner':''} ${showdownLoser?'showdownLoser':''}`}>
      <div className="avatar v2SeatAvatar"><span>{initials}</span></div>
      <div className="v2SeatText"><b>{player.name}{player.host?' ★':''}</b><span className="seatStack">{player.chips.toLocaleString()}</span></div>
      {pos[index]&&<div className={`positionBadge p${pos[index].replace('/','')}`}>{pos[index]}</div>}
      {won&&<span className="winnerAward">+{Number(winners.get(player.id)||0).toLocaleString()}</span>}
      {player.turn&&turnLeft!=null&&<div className={`turnClock ${turnLeft<=10?'dangerClock':''}`}>{turnLeft}s</div>}
      {allIn&&<em>ALL IN</em>}
      {player.eliminated&&<em>OUT</em>}
      {me?.host&&!state.started&&!player.host&&!finished&&<button className="seatKick" onClick={()=>onKick(player.id)}>×</button>}
    </div>
    {showCards&&<div className={`seatCards v2SeatCards seatCards${index} ${player.folded?'foldedSeatCards':''}`} data-card-seat={index} data-card-cosmetic={player.cosmetic||'default'}>{cardValues.map((c,j)=><Card c={c} backAsset={backAsset} key={j}/>)}</div>}
    {player.bet>0&&<div data-bet-seat={index} className={`tableBet v2TableBet tableBet${index} ${allIn?'allInBet':''}`}><img className="miniChipArt" src={chipFor(player,'purple')} alt=""/><span>{player.bet.toLocaleString()}</span></div>}
  </div>;
}

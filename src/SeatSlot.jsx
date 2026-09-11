import React from'react';
import{Card,ordinal}from'./TablePanels.jsx';
import{plaqueFor,avatarFrameFor,chipFor,cardBackFor}from'./assets.js';

function seatGeometry(index,players,me){
  const n=Math.max(1,players.length),hero=Math.max(0,me?players.findIndex(p=>p.id===me.id):0),rel=(index-hero+n)%n,theta=(90+rel*(360/n))*Math.PI/180,dx=Math.cos(theta),dy=Math.sin(theta),ring={1:[0,0,0,0],2:[34,33,28,29],3:[36,34,29,30],4:[38,35,30,31],5:[40,36,31,32],6:[41.5,37,31.5,32.5],7:[42.5,38,31.5,33],8:[43,38.5,32,33.5],9:[43.5,39,32.5,34]}[Math.min(9,n)]||[43.5,39,32.5,34],desktopSeatX=50+ring[0]*dx,desktopSeatY=50+ring[1]*dy,mobileSeatX=50+ring[2]*dx,mobileSeatY=50+ring[3]*dy;
  return{'--seat-x':`${desktopSeatX.toFixed(2)}%`,'--seat-y':`${desktopSeatY.toFixed(2)}%`,'--mobile-seat-x':`${mobileSeatX.toFixed(2)}%`,'--mobile-seat-y':`${mobileSeatY.toFixed(2)}%`,'--seat-dx':dx.toFixed(3),'--seat-dy':dy.toFixed(3)};
}

export default function SeatSlot({player,index,players,me,pos,turnLeft,isShowdown,winners,finished,onKick,state}){
  const geo=seatGeometry(index,players,me),won=winners.has(player.id),showdownLoser=isShowdown&&player.cards?.some(Boolean)&&!won,allIn=player.chips===0&&!player.eliminated&&state.started,backAsset=cardBackFor(player),showCards=state.started&&!player.eliminated&&me?.id!==player.id,cardValues=isShowdown&&Array.isArray(player.cards)&&player.cards.some(Boolean)?player.cards.slice(0,2):['',''],style={...geo,'--plaque-art':`url(${plaqueFor(player)})`,'--avatar-frame':`url(${avatarFrameFor(player)})`};
  return <div style={style} data-seat-index={index} data-player-id={player.id} data-cosmetic={player.cosmetic||'default'} className={`seatSlot seatSlot${index} ${me?.id===player.id?'heroSlot':''} ${player.turn?'turnSlot':''} ${player.folded?'foldedSlot':''} ${player.eliminated?'outSlot':''} ${allIn?'allInSlot':''} ${won?'winnerSlot':''} ${showdownLoser?'loserSlot':''}`}>
    <div className={`seat productionSeat seat${index} ${me?.id===player.id?'heroSeat':''} ${player.turn?'turn':''} ${player.folded?'folded':''} ${player.eliminated?'out':''} ${allIn?'allInSeat':''} ${won?'showdownWinner':''} ${showdownLoser?'showdownLoser':''}`}>
      {pos[index]&&<div className={`positionBadge p${pos[index].replace('/','')}`}>{pos[index]}</div>}
      <div className="avatar">{player.testBot?'BOT':player.name.slice(0,2).toUpperCase()}</div>
      <b>{player.name}{player.host?' ★':''}</b>
      <span className="seatStack">{player.chips.toLocaleString()}</span>
      {player.testBot&&<span className="seatBotBadge">BOT</span>}
      {won&&<span className="winnerAward">+{Number(winners.get(player.id)||0).toLocaleString()}</span>}
      {player.finishPlace&&<small>{ordinal(player.finishPlace)} place</small>}
      {player.turn&&turnLeft!=null&&<div className={`turnClock ${turnLeft<=10?'dangerClock':''}`}>{turnLeft}s</div>}
      {allIn&&<em>ALL IN</em>}
      {player.eliminated&&<em>OUT</em>}
      {me?.host&&!state.started&&!player.host&&!finished&&<button className="seatKick" onClick={()=>onKick(player.id)}>×</button>}
    </div>
    {showCards&&<div className={`seatCards seatCards${index} ${player.folded?'foldedSeatCards':''}`} data-card-seat={index} data-card-cosmetic={player.cosmetic||'default'}>{cardValues.map((c,j)=><Card c={c} backAsset={backAsset} key={j}/>)}</div>}
    {player.bet>0&&<div data-bet-seat={index} className={`tableBet tableBet${index} ${allIn?'allInBet':''}`}><img className="miniChipArt" src={chipFor(player,'purple')} alt=""/><span>{player.bet.toLocaleString()}</span>{allIn&&<small>ALL IN</small>}</div>}
  </div>;
}

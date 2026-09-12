import React from'react';
import{Card}from'./TablePanels.jsx';
import{assets,cardBackFor,chipFor}from'./assets.js';

const TABLE={x:90,y:194,w:526,h:820};
const SLOT_ANGLES={slot1:270,slot2:315,slot3:0,slot4:45,slot5:135,slot6:180,slot7:225};
const SLOTS={
 slot1:{seat:{x:282,y:208,w:132,h:52},cards:{x:373,y:237,w:43,h:20},bet:{x:324,y:291,w:54,h:30}},
 slot2:{seat:{x:521,y:328,w:132,h:52},cards:{x:607,y:352,w:48,h:36},bet:{x:452,y:368,w:54,h:30}},
 slot3:{seat:{x:561,y:543,w:132,h:52},cards:{x:648,y:570,w:48,h:36},bet:{x:491,y:565,w:54,h:30}},
 slot4:{seat:{x:551,y:707,w:132,h:52},cards:{x:635,y:738,w:48,h:36},bet:{x:472,y:713,w:54,h:30}},
 slot5:{seat:{x:17,y:707,w:132,h:52},cards:{x:104,y:733,w:48,h:36},bet:{x:186,y:718,w:54,h:30}},
 slot6:{seat:{x:15,y:543,w:132,h:52},cards:{x:101,y:570,w:48,h:36},bet:{x:164,y:570,w:54,h:30}},
 slot7:{seat:{x:52,y:328,w:132,h:52},cards:{x:136,y:358,w:48,h:36},bet:{x:196,y:368,w:54,h:30}}
};
const CENTER={board:{x:164,y:470,w:382,h:78},street:{x:230,y:409,w:250,h:54},pot:{x:275,y:564,w:160,h:74},sides:[{x:109,y:646,w:94,h:44},{x:210,y:646,w:94,h:44},{x:311,y:646,w:94,h:44},{x:412,y:646,w:94,h:44},{x:513,y:646,w:94,h:44}]};

function rectStyle(r){return{left:`${((r.x-TABLE.x)/TABLE.w)*100}%`,top:`${((r.y-TABLE.y)/TABLE.h)*100}%`,width:`${(r.w/TABLE.w)*100}%`,height:`${(r.h/TABLE.h)*100}%`}}
function angleDiff(a,b){const d=Math.abs(a-b)%360;return Math.min(d,360-d)}
function mapOpponents(players,me){
 const n=Math.max(1,players.length),hero=Math.max(0,me?players.findIndex(p=>p.id===me.id):0),opponents=players.map((player,index)=>({player,index,rel:(index-hero+n)%n})).filter(x=>x.rel!==0),free=new Set(Object.keys(SLOTS));
 return opponents.sort((a,b)=>a.rel-b.rel).map(item=>{const angle=(90+item.rel*(360/n))%360;let best=null,bestDiff=Infinity;for(const key of free){const diff=angleDiff(angle,SLOT_ANGLES[key]);if(diff<bestDiff){best=key;bestDiff=diff}}if(!best){best='slot1'}else free.delete(best);return{...item,slot:best}})
}
function showdownWinners(state){if(state.street!=='showdown')return new Map();const wins=new Map();for(const award of state.lastResult?.awards||[])wins.set(award.playerId,(wins.get(award.playerId)||0)+Number(award.amount||0));return wins}

function ApprovedSeat({entry,state,me,pos,turnLeft,winners}){
 const{player,index,slot}=entry,box=SLOTS[slot],won=winners.has(player.id),allIn=player.chips===0&&!player.eliminated&&state.started,isShowdown=state.street==='showdown',showCards=state.started&&!player.eliminated,values=isShowdown&&Array.isArray(player.cards)&&player.cards.some(Boolean)?player.cards.slice(0,2):['',''],back=cardBackFor(player),initials=player.testBot?'BOT':player.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
 return <>
  <div className={`approvedCashSeat ${player.turn?'turn':''} ${player.folded?'folded':''} ${player.eliminated?'out':''} ${allIn?'allin':''} ${won?'winner':''}`} style={rectStyle(box.seat)} data-approved-slot={slot}>
   <span className="approvedCashAvatar">{initials}</span><span className="approvedCashSeatCopy"><b>{player.name}{player.host?' ★':''}</b><strong>{Number(player.chips||0).toLocaleString()}</strong></span>
   {pos[index]&&<i className="approvedCashPosition">{pos[index]}</i>}{player.turn&&turnLeft!=null&&<em className="approvedCashClock">{turnLeft}s</em>}{won&&<span className="approvedCashAward">+{Number(winners.get(player.id)||0).toLocaleString()}</span>}
  </div>
  {showCards&&<div className={`approvedCashCards ${player.folded?'folded':''}`} style={rectStyle(box.cards)}>{values.map((c,j)=><Card c={c} backAsset={back} key={j}/>)}</div>}
  {player.bet>0&&<div className="approvedCashBet" style={rectStyle(box.bet)}><img src={chipFor(player,'purple')} alt=""/><span>{Number(player.bet).toLocaleString()}</span></div>}
 </>
}

export default function ApprovedCashFelt({state,finished,showdownLeft,pos,turnLeft,me}){
 const winners=showdownWinners(state),mapped=mapOpponents(state.players,me),isShowdown=state.street==='showdown',live=Array.isArray(state.livePots)?state.livePots:[],showSlices=!isShowdown&&live.length>1,displayPot=isShowdown?Number(state.lastResult?.settledPot||0):Number(state.pot||0);
 return <section className={`gameplayV2Felt approvedCashFelt ${isShowdown?'approvedShowdown':''}`} data-player-count={state.players.length} data-street={state.street}>
  <img className="approvedCashFeltImage" src={assets.default.feltCashV2} alt=""/>
  {mapped.map(entry=><ApprovedSeat key={entry.player.id} entry={entry} state={state} me={me} pos={pos} turnLeft={turnLeft} winners={winners}/>) }
  <div className="approvedCashBoard" style={rectStyle(CENTER.board)}>{state.board.map((c,i)=><Card key={`${state.handNumber}-${i}`} c={c}/>)}</div>
  {state.started&&state.board.length===0&&!finished&&<div className="approvedCashStreet" style={rectStyle(CENTER.street)}>{state.paused?'Paused':'Pre-flop'}</div>}
  {!state.started&&!finished&&<div className="approvedCashStreet" style={rectStyle(CENTER.street)}>Waiting for host to start</div>}
  <div className="approvedCashPot" style={rectStyle(CENTER.pot)}><small>{isShowdown?'AWARDED':'POT'}</small><strong>{displayPot.toLocaleString()}</strong></div>
  {showSlices&&live.slice(0,5).map((p,i)=><div className="approvedCashSide" style={rectStyle(CENTER.sides[i])} key={i}><small>{i===0?'MAIN POT':`SIDE POT ${i}`}</small><strong>{Number(p.amount||0).toLocaleString()}</strong></div>)}
  {isShowdown&&state.lastResult&&<div className="approvedCashShowdown"><small>SHOWDOWN • NEXT HAND IN {showdownLeft}s</small><strong>{state.lastResult.summary}</strong></div>}
  {finished&&<div className="approvedCashShowdown"><small>{state.endedByHost?'GAME ENDED':'GAME COMPLETE'}</small><strong>{state.message}</strong></div>}
 </section>
}

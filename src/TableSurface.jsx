import React from'react';
import'./gameplay-v3.css';
import{Card}from'./TablePanels.jsx';
import{assets,avatarFrameFor,cardBackFor,chipFor}from'./assets.js';

const SLOT_MAP={
  1:['topCenter'],
  2:['upperLeft','upperRight'],
  3:['upperLeft','topCenter','upperRight'],
  4:['upperLeft','upperRight','lowerLeft','lowerRight'],
  5:['upperLeft','topCenter','upperRight','lowerRight','lowerLeft'],
  6:['lowerLeft','midLeft','upperLeft','upperRight','midRight','lowerRight'],
  7:['lowerLeft','midLeft','upperLeft','topCenter','upperRight','midRight','lowerRight'],
  8:['lowerLeft9','midLeft9','upperLeft9','topLeft9','topRight9','upperRight9','midRight9','lowerRight9']
};

function showdownWinners(state){
  if(state.street!=='showdown')return new Map();
  const wins=new Map();
  for(const award of state.lastResult?.awards||[])wins.set(award.playerId,(wins.get(award.playerId)||0)+Number(award.amount||0));
  return wins;
}

function initials(name='Player'){
  return String(name).trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()||'FT';
}

function seatEntries(players,me){
  const heroIndex=me?players.findIndex(p=>p.id===me.id):-1;
  let ordered;
  if(heroIndex<0)ordered=players.map((player,index)=>({player,index,rel:index+1}));
  else ordered=players.map((player,index)=>({player,index,rel:(index-heroIndex+players.length)%players.length})).filter(x=>x.rel!==0).sort((a,b)=>a.rel-b.rel);
  const slots=SLOT_MAP[Math.min(8,Math.max(1,ordered.length))]||SLOT_MAP[8];
  return ordered.slice(0,8).map((entry,i)=>({...entry,slot:slots[i]||slots[slots.length-1]}));
}

function UserPlusIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19c0-3-2.5-5-5.5-5S4 16 4 19"/><circle cx="9.5" cy="8" r="3.5"/><path d="M18 7v6M15 10h6"/></svg>}
function ChatIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H10l-5 3v-3H4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>}
function LogIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h5"/></svg>}
function CrownIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l4.2 4L12 5l4.8 6L21 7l-2 11H5z"/></svg>}

export function TableTopbar({code,state,realtime,blindLeft,copied,onCopy,onExit,onChat,onHistory,showChat,showHistory}){
  if(!state.started)return <header className="topbar"><button className="ghost" onClick={onExit}>← Lobby</button><div><b>TABLE {code}</b><span>{state.smallBlind}/{state.bigBlind} NLH</span></div><button className="ghost" onClick={onCopy}>{copied?'Copied ✓':'Copy Invite'}</button></header>;
  return <header className="v3Topbar">
    <button className="v3BackButton" onClick={onExit} aria-label="Back to lobby">‹</button>
    <div className="v3HeaderIdentity">
      <img className="v3HeaderLogo" src={assets.default.logoMobile} alt="Full Tilt Poker"/>
      <strong className="v3HeaderBlinds">{state.smallBlind.toLocaleString()} / {state.bigBlind.toLocaleString()} NLH</strong>
      <div className="v3HeaderMeta"><span>Table {code}</span><i/><span>Hand #{state.handNumber||0}</span>{blindLeft&&blindLeft!=='—'?<><i/><span>{blindLeft}</span></>:null}</div>
    </div>
    <button className="v3InviteButton" onClick={onCopy}>{copied?'✓ Copied':<><UserPlusIcon/>Invite</>}</button>
    <div className="v3UtilityRow">
      <button className={`v3UtilityButton ${showChat?'active':''}`} onClick={onChat}><ChatIcon/>Chat</button>
      <button className={`v3UtilityButton ${showHistory?'active':''}`} onClick={onHistory}><LogIcon/>Hand Log</button>
    </div>
  </header>;
}

export function InfoStrip({alive,state,blindLeft}){
  return <div className="infoStrip v3InfoStrip"><span><b>{alive}</b> left</span><span><b>{state.pot.toLocaleString()}</b> pot</span><span><b>{state.street?.toUpperCase()}</b> street</span><span><b>{state.paused?'PAUSED':blindLeft}</b> blinds</span></div>;
}

function V3Seat({entry,state,pos,turnLeft,winners}){
  const{player,index,slot}=entry;
  const isShowdown=state.street==='showdown',won=winners.has(player.id),allIn=player.chips===0&&!player.eliminated&&state.started;
  const values=isShowdown&&Array.isArray(player.cards)&&player.cards.some(Boolean)?player.cards.slice(0,2):['',''];
  const back=cardBackFor(player),frame=avatarFrameFor(player),avatar=player.avatar||player.avatarUrl||'';
  return <div className={`v3SeatAnchor v3Slot-${slot} ${player.turn?'turn':''} ${player.folded?'folded':''} ${player.eliminated?'out':''} ${allIn?'allin':''} ${won?'winner':''}`}>
    {!player.eliminated&&<div className="v3SeatCardFan">{values.map((c,j)=><Card c={c} backAsset={back} key={j}/>)}</div>}
    <div className="v3SeatPlaque">
      <span className="v3SeatAvatarWrap"><span className="v3SeatAvatar">{avatar?<img src={avatar} alt=""/>:initials(player.name)}</span><img className="v3SeatAvatarFrame" src={frame} alt=""/></span>
      <b className="v3SeatName">{player.name}</b>
      <strong className="v3SeatStack">{Number(player.chips||0).toLocaleString()}</strong>
      {pos[index]&&<i className="v3SeatPosition">{pos[index]}</i>}
      {player.turn&&turnLeft!=null&&!won&&<em className="v3SeatClock">{turnLeft}s</em>}
      {won&&<span className="v3SeatAward">+{Number(winners.get(player.id)||0).toLocaleString()}</span>}
    </div>
    {player.bet>0&&<div className="v3SeatBet"><img src={chipFor(player,'purple')} alt=""/><span>{Number(player.bet).toLocaleString()}</span></div>}
  </div>;
}

function V3Pot({state,isShowdown}){
  const live=Array.isArray(state.livePots)?state.livePots:[],displayPot=isShowdown?Number(state.lastResult?.settledPot||0):Number(state.pot||0),showSide=!isShowdown&&live.length>1;
  return <div className="v3PotCluster">
    <div className="v3MainPot"><img src={assets.default.pot} alt=""/><small>{isShowdown?'AWARDED':'POT'}</small><strong>{displayPot.toLocaleString()}</strong></div>
    {showSide&&<div className="v3SidePots">{live.slice(0,4).map((p,i)=><div className="v3SidePot" key={i}><img src={assets.default.chips.purple} alt=""/><span>{i===0?'Main':`Side ${i}`} {Number(p.amount||0).toLocaleString()}</span></div>)}</div>}
  </div>;
}

export function PokerFelt({state,finished,showdownLeft,pos,turnLeft,me}){
  if(!state.started&&!finished){
    return <section className="felt productionFelt" style={{'--felt-desktop':`url(${assets.default.feltDesktop})`,'--felt-mobile':`url(${assets.default.feltMobile})`}}><div className="v2FeltBrand"><b>FULL TILT</b><span>DEGENS PLAY HERE</span></div><div className="board"><span className="waiting">Waiting for host to start</span></div></section>;
  }
  const winners=showdownWinners(state),isShowdown=state.street==='showdown',mapped=seatEntries(state.players,me);
  return <section className={`v3Felt ${isShowdown?'showdown':''}`} data-player-count={state.players.length} data-street={state.street}>
    <div className="v3FeltShadow"/>
    <img className="v3FeltArt" src={assets.default.feltCashV2} alt=""/>
    <div className="v3FeltGlow"/>
    <div className="v3CenterBrand"><img src={assets.default.logoMobile} alt=""/><span>DEGENS PLAY HERE</span></div>
    {mapped.map(entry=><V3Seat key={entry.player.id} entry={entry} state={state} pos={pos} turnLeft={turnLeft} winners={winners}/>) }
    <div className="v3Board">{state.board.map((c,i)=><Card key={`${state.handNumber}-${i}`} c={c}/>)}</div>
    {state.board.length===0&&!finished&&<div className="v3StreetMessage">{state.paused?'Game paused':'Pre-flop'}</div>}
    <V3Pot state={state} isShowdown={isShowdown}/>
    {isShowdown&&state.lastResult&&<div className="v3ShowdownBanner"><small>SHOWDOWN • NEXT HAND IN {showdownLeft}s</small><strong>{state.lastResult.summary}</strong></div>}
  </section>;
}

export function TableHUD({state,me,isSpectator,strength,turnLeft,raise,setRaise,onAction}){
  if(!state.started){
    return <section className="hud"><div className="actions">{me?.host&&state.street!=='finished'&&<div className="hostControls"><button className="primary" onClick={()=>onAction('start')}>Start Game ({state.players.length})</button>{state.players.length<9&&<button onClick={()=>onAction('addbot')}>+ Add Test Bot</button>}</div>}{isSpectator&&<span className="readOnlyNote">Watching only</span>}</div></section>;
  }
  const canAct=!!(me&&!state.paused&&state.street!=='showdown'&&me.turn&&!me.folded&&!me.eliminated&&me.chips>0);
  const callCost=Math.min(Number(me?.chips||0),Math.max(0,Number(state.toCall||0)));
  const minRaiseTarget=Math.max(0,Number(state.raiseTo||0));
  const maxRaiseTarget=Math.max(minRaiseTarget,Number(me?.bet||0)+Number(me?.chips||0));
  const customRaiseTarget=Math.min(maxRaiseTarget,Math.max(minRaiseTarget,Number(raise||minRaiseTarget)));
  const isShowdown=state.street==='showdown';
  const quickRaise=fraction=>{if(!canAct||!state.canRaise)return;const call=Math.max(0,state.toCall||0),pot=Math.max(0,state.pot||0),min=minRaiseTarget;setRaise(String(Math.min(maxRaiseTarget,Math.max(min,Math.round((state.currentBet||0)+call+pot*fraction)))))};
  const actionText=canAct?(state.toCall>0?`${state.toCall.toLocaleString()} to call`:'Check is free'):state.paused?'Paused':isShowdown?'Showdown':state.message||state.street?.toUpperCase();
  return <section className={`v3Hud ${canAct?'acting':''} ${isShowdown?'showdown':''}`}>
    {me?<div className="v3HeroZone">
      <div className="v3HeroCards">{me.cards?.length?me.cards.slice(0,2).map((c,i)=><Card key={i} c={c} backAsset={cardBackFor(me)}/>):<><Card c="" backAsset={cardBackFor(me)}/><Card c="" backAsset={cardBackFor(me)}/></>}</div>
      <div className="v3HeroPlaque"><span className="v3HeroCrown"><CrownIcon/></span><span className="v3HeroOnline"/><div className="v3HeroCopy"><small>YOU</small><strong>{Number(me.chips||0).toLocaleString()}</strong></div></div>
      {strength&&!me.folded&&!isShowdown&&<div className="v3HandStrength">{strength}</div>}
    </div>:<div className="v3SpectatorHero">WATCHING • NO HOLE CARDS</div>}
    <div className={`v3TurnStatus ${canAct?'acting':''}`}>{actionText}{turnLeft!=null&&!state.paused&&!isShowdown&&<span className={`v3TurnClock ${turnLeft<=10?'danger':''}`}>{turnLeft}s</span>}</div>
    {!isSpectator&&<div className="v3ActionDock">
      <div className="v3ActionRow">
        <button className="v3ActionButton fold" disabled={!canAct} onClick={()=>onAction('fold')}>Fold</button>
        <button className="v3ActionButton check" disabled={!canAct} onClick={()=>onAction(state.toCall===0?'check':'call')}>{state.toCall===0?'Check':<>Call<small>{callCost.toLocaleString()}</small></>}</button>
        <button className="v3ActionButton raise" disabled={!canAct||!state.canRaise} onClick={()=>onAction('raise',customRaiseTarget)}><span className="v3ActionIcon">⌃</span>Raise<small>to {customRaiseTarget.toLocaleString()}</small></button>
        <button className="v3ActionButton allin" disabled={!canAct||!state.canAllIn} onClick={()=>onAction('allin')}><span className="v3ActionIcon">◉</span>All In<small>{Number(me?.chips||0).toLocaleString()}</small></button>
      </div>
      <div className="v3RaiseBar">
        <span className="v3RaiseLabel">Bet Size: <b>{customRaiseTarget.toLocaleString()}</b></span>
        <input type="range" min={minRaiseTarget} max={maxRaiseTarget} step="1" value={customRaiseTarget} disabled={!canAct||!state.canRaise} onChange={e=>setRaise(e.target.value)}/>
        <button className="v3QuickBet" disabled={!canAct||!state.canRaise} onClick={()=>quickRaise(.25)}>25%</button>
        <button className="v3QuickBet" disabled={!canAct||!state.canRaise} onClick={()=>quickRaise(.5)}>50%</button>
        <button className="v3QuickBet" disabled={!canAct||!state.canRaise} onClick={()=>quickRaise(.75)}>75%</button>
        <button className="v3QuickBet" disabled={!canAct||!state.canRaise} onClick={()=>setRaise(String(maxRaiseTarget))}>Max</button>
      </div>
    </div>}
    {me?.host&&<div className="v3HostControls">{!isShowdown&&<button onClick={()=>onAction(state.paused?'resume':'pause')}>{state.paused?'Resume':'Pause'}</button>}<button className="danger" onClick={()=>onAction('end')}>End Game</button></div>}
  </section>;
}

import React,{useEffect,useMemo,useState}from'react';
import{Card}from'./TablePanels.jsx';
import'./hand-replay.css';

const SEATS=[
 [50,91],[23,82],[8,57],[16,27],[39,10],[61,10],[84,27],[92,57],[77,82]
];
function safeSteps(hand){
 const steps=Array.isArray(hand?.replay?.steps)?hand.replay.steps:[];
 if(!Array.isArray(hand?.rabbitBoard)||hand.rabbitBoard.length!==5)return steps;
 const last=steps.at(-1)||{},players=Array.isArray(last.players)?last.players:[];
 return[...steps,{...last,index:steps.length,type:'rabbit',text:'Rabbit Hunt • hypothetical runout only',street:'rabbit',board:[...hand.rabbitBoard],pot:Number(hand.settledPot||last.pot||0),players,hypothetical:true}];
}
function revealedMap(hand){return new Map((hand?.revealed||[]).map(r=>[String(r.playerId),Array.isArray(r.cards)?r.cards:[]]))}
function seatPosition(index){return SEATS[Math.max(0,Math.min(SEATS.length-1,Number(index)||0))]||SEATS[0]}

export default function HandReplay({hand,onClose}){
 const steps=useMemo(()=>safeSteps(hand),[hand]),revealed=useMemo(()=>revealedMap(hand),[hand]),[stepIndex,setStepIndex]=useState(0),[playing,setPlaying]=useState(false);
 useEffect(()=>{setStepIndex(0);setPlaying(false)},[hand]);
 useEffect(()=>{if(!playing||steps.length<2)return;const id=setInterval(()=>setStepIndex(i=>{if(i>=steps.length-1){setPlaying(false);return i}return i+1}),1100);return()=>clearInterval(id)},[playing,steps.length]);
 useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose?.();else if(e.key==='ArrowRight')setStepIndex(i=>Math.min(steps.length-1,i+1));else if(e.key==='ArrowLeft')setStepIndex(i=>Math.max(0,i-1))};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[onClose,steps.length]);
 if(!hand?.replay||!steps.length)return null;
 const step=steps[Math.min(stepIndex,steps.length-1)],meta=hand.replay,progress=steps.length>1?Math.round(stepIndex/(steps.length-1)*100):100;
 return <div className="replayOverlay" role="dialog" aria-modal="true" aria-label={'Hand #'+hand.handNumber+' replay'} onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
  <section className="replayModal">
   <header className="replayHeader"><div><small>HAND REPLAYER</small><b>Hand #{hand.handNumber}</b><span>{meta.smallBlind}/{meta.bigBlind} NLH{meta.ante?' • BBA '+meta.ante:''}</span></div><button onClick={onClose} aria-label="Close hand replay">×</button></header>
   <div className="replayProgress"><i style={{width:String(progress)+'%'}}/></div>
   <div className={'replayFelt '+(step.hypothetical?'rabbitStep':'')}>
    <div className="replayBoard">{Array.from({length:5},(_,i)=><Card key={i} c={step.board?.[i]||''}/>)}</div>
    <div className="replayPot"><small>{step.hypothetical?'RABBIT POT':'POT'}</small><b>{Number(step.pot||0).toLocaleString()}</b></div>
    {step.hypothetical&&<div className="replayRabbitFlag">RABBIT RUNOUT • DID NOT AFFECT THE HAND</div>}
    {(step.players||[]).map(p=>{const pos=seatPosition(p.seatIndex),left=pos[0],top=pos[1],cards=revealed.get(String(p.id))||[],dealer=Number(p.seatIndex)===Number(meta.dealerIndex);return <div key={p.id} className={'replaySeat '+(p.folded?'folded ':'')+(p.allIn?'allin ':'')+(step.turnPlayerId===p.id?'turn':'')} style={{left:String(left)+'%',top:String(top)+'%'}}>
     <div className="replaySeatTop">{dealer&&<i>D</i>}<b>{p.name}</b></div>
     <span>{Number(p.chips||0).toLocaleString()}</span>
     {Number(p.bet||0)>0&&<em>BET {Number(p.bet).toLocaleString()}</em>}
     {cards.length===2&&<div className="replayHole">{cards.map((c,i)=><Card c={c} key={i}/>)}</div>}
     {p.folded&&<small>FOLDED</small>}{p.allIn&&<small>ALL IN</small>}
    </div>})}
   </div>
   <div className="replayEvent"><small>{String(step.street||'').toUpperCase()} • STEP {stepIndex+1}/{steps.length}</small><strong>{step.text||(stepIndex===0?'Blinds posted':'Table state')}</strong></div>
   <footer className="replayControls"><button disabled={stepIndex===0} onClick={()=>setStepIndex(i=>Math.max(0,i-1))}>‹ Back</button><button className="replayPlay" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button disabled={stepIndex>=steps.length-1} onClick={()=>setStepIndex(i=>Math.min(steps.length-1,i+1))}>Next ›</button></footer>
  </section>
 </div>
}

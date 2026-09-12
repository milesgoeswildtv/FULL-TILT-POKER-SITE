import React,{useEffect,useMemo,useRef,useState}from'react';
import'./layout-lab.css';
import{assets}from'./assets.js';

const W=710,H=1536,STORE='full-tilt-layout-lab-v1';
const seed={
  table:{x:92,y:200,w:526,h:820,type:'table'},
  seat1:{x:289,y:216,w:132,h:52,type:'seat',name:'Tilt Gremlin',stack:'2,480'},cards1:{x:333,y:271,w:48,h:36,type:'backs'},bet1:{x:329,y:316,w:54,h:30,type:'bet',text:'20'},
  seat2:{x:506,y:328,w:132,h:52,type:'seat',name:'Bad Beat',stack:'2,480'},cards2:{x:548,y:383,w:48,h:36,type:'backs'},bet2:{x:492,y:438,w:54,h:30,type:'bet',text:'20'},
  seat3:{x:526,y:526,w:132,h:52,type:'seat',name:'Pocket Trash',stack:'2,480'},cards3:{x:563,y:580,w:48,h:36,type:'backs'},bet3:{x:496,y:610,w:54,h:30,type:'bet',text:'40'},
  seat4:{x:461,y:707,w:132,h:52,type:'seat',name:'Shove More',stack:'2,420'},cards4:{x:500,y:758,w:48,h:36,type:'backs'},bet4:{x:442,y:683,w:54,h:30,type:'bet',text:'40'},
  seat5:{x:117,y:707,w:132,h:52,type:'seat',name:'Muck Rat',stack:'2,460'},cards5:{x:154,y:758,w:48,h:36,type:'backs'},bet5:{x:211,y:683,w:54,h:30,type:'bet',text:'20'},
  seat6:{x:52,y:526,w:132,h:52,type:'seat',name:'River Goblin',stack:'2,480'},cards6:{x:91,y:580,w:48,h:36,type:'backs'},bet6:{x:159,y:610,w:54,h:30,type:'bet',text:'10'},
  seat7:{x:72,y:328,w:132,h:52,type:'seat',name:'Call Station',stack:'2,460'},cards7:{x:111,y:383,w:48,h:36,type:'backs'},bet7:{x:166,y:438,w:54,h:30,type:'bet',text:'20'},
  board:{x:164,y:470,w:382,h:78,type:'board'},street:{x:230,y:409,w:250,h:54,type:'street'},
  pot:{x:275,y:564,w:160,h:74,type:'pot'},side1:{x:109,y:646,w:94,h:44,type:'side',text:'Main 80'},side2:{x:210,y:646,w:94,h:44,type:'side',text:'Side 1 70'},side3:{x:311,y:646,w:94,h:44,type:'side',text:'Side 2 120'},side4:{x:412,y:646,w:94,h:44,type:'side',text:'Side 3 60'},side5:{x:513,y:646,w:94,h:44,type:'side',text:'Side 4 40'},
  heroCards:{x:298,y:920,w:114,h:78,type:'heroCards'},heroRank:{x:290,y:1000,w:130,h:30,type:'rank'},heroSeat:{x:270,y:1036,w:170,h:62,type:'hero'},
  chat:{x:18,y:1065,w:120,h:62,type:'pill',text:'CHAT'},handLog:{x:572,y:1065,w:120,h:62,type:'pill',text:'HAND LOG'},
  dock:{x:18,y:1142,w:674,h:365,type:'dock'}
};

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function loadSeed(){try{const raw=localStorage.getItem(STORE);return raw?{...seed,...JSON.parse(raw)}:seed}catch{return seed}}

function Card({children}){return <div className="labFaceCard">{children}</div>}
function Piece({id,item,selected,onPointerDown,onResizeDown}){
  const style={left:item.x,top:item.y,width:item.w,height:item.h};
  let body=null;
  if(item.type==='table')body=<img className="labFeltImage" src={assets.default.feltCashV2} alt="Official Full Tilt cash felt"/>;
  else if(item.type==='seat')body=<div className="labSeat"><b>{item.name}</b><strong>{item.stack}</strong></div>;
  else if(item.type==='hero')body=<div className="labHero"><small>YOU</small><strong>2,500</strong></div>;
  else if(item.type==='backs')body=<div className="labBacks"><i>FT</i><i>FT</i></div>;
  else if(item.type==='bet')body=<div className="labBet">{item.text}</div>;
  else if(item.type==='board')body=<div className="labBoard"><Card>T♥</Card><Card>3♠</Card><Card>T♣</Card><Card>8♦</Card><Card>7♣</Card></div>;
  else if(item.type==='street')body=<div className="labStreet">Pre-flop</div>;
  else if(item.type==='pot')body=<div className="labPot"><small>POT</small><strong>370</strong></div>;
  else if(item.type==='side')body=<div className="labSide">{item.text}</div>;
  else if(item.type==='heroCards')body=<div className="labHeroCards"><Card>A♦</Card><Card>4♦</Card></div>;
  else if(item.type==='rank')body=<div className="labRank">HIGH CARD</div>;
  else if(item.type==='pill')body=<div className="labPill">{item.text}</div>;
  else if(item.type==='dock')body=<div className="labDock"><div className="labActions"><button>Fold</button><button>Call<small>20</small></button><button className="raise">Raise<small>to 40</small></button><button className="allin">All In<small>2,500</small></button></div><div className="labSlider"><span>Bet Size: <b>40</b></span><div className="labTrack"><i/></div><div className="labPresets"><button>25%</button><button>50%</button><button>75%</button><button>Max</button></div></div></div>;
  return <div className={`labPiece ${selected?'selected':''} lab-${item.type}`} style={style} data-id={id} onPointerDown={e=>onPointerDown(e,id)}>{body}{selected&&<button className="labResize" aria-label="Resize" onPointerDown={e=>onResizeDown(e,id)}>↘</button>}</div>
}

export default function LayoutLab({onExit}){
  const[layout,setLayout]=useState(loadSeed),[selected,setSelected]=useState('table'),[scale,setScale]=useState(.5),[grid,setGrid]=useState(false),[notice,setNotice]=useState('');
  const hostRef=useRef(null),dragRef=useRef(null);
  useEffect(()=>{localStorage.setItem(STORE,JSON.stringify(layout))},[layout]);
  useEffect(()=>{const fit=()=>{const el=hostRef.current;if(!el)return;const r=el.getBoundingClientRect(),availH=window.innerHeight-r.top-10,availW=window.innerWidth-12;setScale(clamp(Math.min(availW/W,availH/H),.26,1))};fit();addEventListener('resize',fit);return()=>removeEventListener('resize',fit)},[]);
  const exportJson=useMemo(()=>JSON.stringify({viewport:{width:W,height:H},elements:layout},null,2),[layout]);
  function startDrag(e,id){if(e.target.closest('.labResize'))return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);const p=layout[id];dragRef.current={mode:'move',id,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y};setSelected(id)}
  function startResize(e,id){e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture?.(e.pointerId);const p=layout[id];dragRef.current={mode:'resize',id,startX:e.clientX,startY:e.clientY,w:p.w,h:p.h};setSelected(id)}
  useEffect(()=>{const move=e=>{const d=dragRef.current;if(!d)return;const dx=(e.clientX-d.startX)/scale,dy=(e.clientY-d.startY)/scale;setLayout(prev=>{const p=prev[d.id];if(!p)return prev;if(d.mode==='move')return{...prev,[d.id]:{...p,x:Math.round(d.x+dx),y:Math.round(d.y+dy)}};return{...prev,[d.id]:{...p,w:Math.max(20,Math.round(d.w+dx)),h:Math.max(20,Math.round(d.h+dy))}}})};const up=()=>dragRef.current=null;addEventListener('pointermove',move,{passive:false});addEventListener('pointerup',up);addEventListener('pointercancel',up);return()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up)}},[scale]);
  async function copy(){try{await navigator.clipboard.writeText(exportJson);setNotice('Layout JSON copied. Paste it back into ChatGPT.')}catch{setNotice('Copy failed on this browser. Use Share Layout below.')}}
  function share(){const blob=new Blob([exportJson],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='full-tilt-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);setNotice('Layout JSON downloaded.')}
  function reset(){localStorage.removeItem(STORE);setLayout(seed);setSelected('table');setNotice('Reset to starting layout.')}
  const s=layout[selected];
  function nudge(dx,dy){if(!selected)return;setLayout(p=>({...p,[selected]:{...p[selected],x:p[selected].x+dx,y:p[selected].y+dy}}))}
  return <main className="layoutLabPage">
    <header className="layoutLabBar"><button onClick={onExit}>‹ Poker</button><div><b>FULL TILT LAYOUT LAB</b><span>710 × 1536 exact coordinate canvas</span></div><div className="layoutLabZoom"><button onClick={()=>setScale(v=>clamp(v-.05,.26,1.25))}>−</button><strong>{Math.round(scale*100)}%</strong><button onClick={()=>setScale(v=>clamp(v+.05,.26,1.25))}>+</button></div></header>
    <section className="layoutLabTools"><button className={grid?'active':''} onClick={()=>setGrid(v=>!v)}>Grid</button><button onClick={()=>setScale(.46)}>Fit</button><button onClick={()=>setScale(1)}>100%</button><button onClick={copy}>Copy Layout</button><button onClick={share}>Download JSON</button><button onClick={reset}>Reset</button></section>
    <section ref={hostRef} className="layoutLabViewport"><div className="layoutLabFrame" style={{width:W*scale,height:H*scale}}><div className={`layoutLabCanvas ${grid?'showGrid':''}`} style={{width:W,height:H,transform:`scale(${scale})`}}>
      <div className="layoutLabBackdrop"/>
      {Object.entries(layout).map(([id,item])=><Piece key={id} id={id} item={item} selected={selected===id} onPointerDown={startDrag} onResizeDown={startResize}/>) }
    </div></div></section>
    <aside className="layoutLabInspector"><div className="layoutLabInspectorHead"><b>{selected||'Nothing selected'}</b>{s&&<span>X {s.x} · Y {s.y} · {s.w}×{s.h}</span>}</div>{s&&<><div className="layoutLabNudges"><button onClick={()=>nudge(0,-5)}>↑</button><button onClick={()=>nudge(-5,0)}>←</button><button onClick={()=>nudge(5,0)}>→</button><button onClick={()=>nudge(0,5)}>↓</button></div><div className="layoutLabFields"><label>X<input type="number" value={s.x} onChange={e=>setLayout(p=>({...p,[selected]:{...p[selected],x:Number(e.target.value)}}))}/></label><label>Y<input type="number" value={s.y} onChange={e=>setLayout(p=>({...p,[selected]:{...p[selected],y:Number(e.target.value)}}))}/></label><label>W<input type="number" value={s.w} onChange={e=>setLayout(p=>({...p,[selected]:{...p[selected],w:Number(e.target.value)}}))}/></label><label>H<input type="number" value={s.h} onChange={e=>setLayout(p=>({...p,[selected]:{...p[selected],h:Number(e.target.value)}}))}/></label></div></>}{notice&&<div className="layoutLabNotice">{notice}</div>}</aside>
  </main>
}

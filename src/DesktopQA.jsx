import React,{useEffect,useMemo,useRef,useState}from'react';
import'./desktop-qa.css';

const PRESETS=[
 {label:'1366 × 768',width:1366,height:768},
 {label:'1440 × 900',width:1440,height:900},
 {label:'1920 × 1080',width:1920,height:1080}
];

export default function DesktopQA(){
 const[preset,setPreset]=useState(PRESETS[1]),[zoom,setZoom]=useState('fit'),[viewport,setViewport]=useState({width:390,height:844}),iframeRef=useRef(null);
 useEffect(()=>{const sync=()=>setViewport({width:window.innerWidth,height:window.innerHeight});sync();addEventListener('resize',sync);return()=>removeEventListener('resize',sync)},[]);
 const fit=Math.min(1,Math.max(.15,(viewport.width-18)/preset.width));
 const scale=zoom==='fit'?fit:Number(zoom);
 const src=useMemo(()=>{const u=new URL(location.origin+location.pathname);u.searchParams.set('desktopQaChild','1');return u.toString()},[]);
 function resetHome(){if(iframeRef.current)iframeRef.current.src=src}
 function reload(){try{iframeRef.current?.contentWindow?.location.reload()}catch{}}
 return <main className="desktopQa">
  <header className="desktopQaToolbar">
   <div className="desktopQaTitle"><strong>DESKTOP QA</strong><span>Real desktop breakpoints, scaled onto your phone</span></div>
   <div className="desktopQaControls">
    <div className="desktopQaPreset">{PRESETS.map(item=><button key={item.label} className={preset.label===item.label?'active':''} onClick={()=>setPreset(item)}>{item.label}</button>)}</div>
    <div className="desktopQaZoom"><button className={zoom==='fit'?'active':''} onClick={()=>setZoom('fit')}>Fit</button><button className={zoom===.35?'active':''} onClick={()=>setZoom(.35)}>35%</button><button className={zoom===.5?'active':''} onClick={()=>setZoom(.5)}>50%</button><button className={zoom===.75?'active':''} onClick={()=>setZoom(.75)}>75%</button></div>
    <div className="desktopQaActions"><button onClick={resetHome}>Home</button><button onClick={reload}>Reload</button><button onClick={()=>{location.hash=''}}>Exit QA</button></div>
   </div>
  </header>
  <section className="desktopQaViewport">
   <div className="desktopQaMeta"><span>{preset.label}</span><span>{Math.round(scale*100)}% scale</span><span>Swipe to pan when zoomed</span></div>
   <div className="desktopQaScroll">
    <div className="desktopQaCanvas" style={{width:preset.width*scale,height:preset.height*scale}}>
     <iframe ref={iframeRef} title="Crashout Poker desktop QA" src={src} style={{width:preset.width,height:preset.height,transform:`scale(${scale})`}}/>
    </div>
   </div>
  </section>
 </main>
}

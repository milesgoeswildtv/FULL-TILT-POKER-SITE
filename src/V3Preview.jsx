import React,{useState}from'react';
import{TableTopbar,PokerFelt,TableHUD}from'./GameplayV3.jsx';
import{assets}from'./assets.js';

const demoPlayers=[
 {id:'hero',name:'You',chips:2340,bet:0,cards:['8c','5d'],turn:true,folded:false,eliminated:false},
 {id:'p1',name:'Tilt Gremlin',chips:2340,bet:0,cards:[],folded:false,eliminated:false},
 {id:'p2',name:'Call Station',chips:2420,bet:20,cards:[],folded:false,eliminated:false},
 {id:'p3',name:'Chip Eater',chips:2420,bet:20,cards:[],folded:false,eliminated:false},
 {id:'p4',name:'Bad Beat',chips:2420,bet:60,cards:[],folded:false,eliminated:false},
 {id:'p5',name:'Shove More',chips:2380,bet:40,cards:[],folded:false,eliminated:false},
 {id:'p6',name:'LuckyPanda',chips:1980,bet:0,cards:[],folded:false,eliminated:false},
 {id:'p7',name:'River Goblin',chips:2420,bet:40,cards:[],folded:false,eliminated:false}
];

const demoState={
 started:true,smallBlind:10,bigBlind:20,handNumber:42,players:demoPlayers,
 board:['7s','Th','6c','Qc'],street:'turn',paused:false,pot:480,
 livePots:[{amount:280},{amount:120},{amount:80}],toCall:0,currentBet:60,raiseTo:80,
 canRaise:true,canAllIn:true,lastResult:null
};

export default function V3Preview(){
 const[raise,setRaise]=useState('80'),[copied,setCopied]=useState(false),[showChat,setShowChat]=useState(false),[showHistory,setShowHistory]=useState(false);
 const me=demoPlayers[0],pageStyle={'--mobile-bg':`url(${assets.default.lobbyMobile})`,'--desktop-bg':`url(${assets.default.lobbyDesktop})`};
 const copy=()=>{setCopied(true);setTimeout(()=>setCopied(false),1200)};
 return <main className="gameplayV3Page" style={pageStyle}>
  <TableTopbar code="AURORA" state={demoState} copied={copied} onCopy={copy} onExit={()=>{location.hash=''}}/>
  <PokerFelt state={demoState} finished={false} showdownLeft={null} pos={{1:'D',2:'SB',3:'BB'}} turnLeft={18} me={me}/>
  <TableHUD state={demoState} me={me} isSpectator={false} strength="High Card" turnLeft={18} raise={raise} setRaise={setRaise} showStats={false} setShowStats={()=>{}} showHistory={showHistory} setShowHistory={setShowHistory} showChat={showChat} setShowChat={setShowChat} onAction={()=>{}}/>
 </main>
}

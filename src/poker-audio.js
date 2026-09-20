import{useEffect,useRef}from'react';

const ROOT='/assets/sfx/';
const MP3_ONLY=new Set([
 'results/pot_win',
 'results/big_pot_win',
 'results/split_pot',
 'results/player_bust'
]);

const GROUPS={
 handStart:['table/hand_start'],
 deal:['cards/hole_cards_01','cards/hole_cards_02','cards/hole_cards_03'],
 flop:['cards/flop_spread_01','cards/flop_spread_02'],
 turn:['cards/turn_card'],
 river:['cards/river_card'],
 fold:['cards/fold_to_muck_01','cards/fold_to_muck_02'],
 check:['table/check_tap_01','table/check_tap_02'],
 call:['chips/call'],
 raise:['chips/raise'],
 allin:['chips/all_in_shove'],
 show:['cards/show_card_flip_01','cards/show_card_flip_02'],
 showdown:['table/showdown_cards'],
 pot:['results/pot_win'],
 bigPot:['results/big_pot_win'],
 splitPot:['results/split_pot'],
 bust:['results/player_bust']
};

const PRELOAD=[
 ...GROUPS.handStart,...GROUPS.deal,...GROUPS.flop,...GROUPS.turn,...GROUPS.river,
 ...GROUPS.fold,...GROUPS.check,...GROUPS.call,...GROUPS.raise,...GROUPS.allin,
 ...GROUPS.show,...GROUPS.showdown,...GROUPS.pot,...GROUPS.bigPot,...GROUPS.splitPot,...GROUPS.bust
];

function storageGet(key,fallback){
 try{const value=localStorage.getItem(key);return value==null?fallback:value}catch{return fallback}
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function audioSupport(){
 if(typeof document==='undefined')return{ogg:false,mp3:true};
 const el=document.createElement('audio');
 return{
  ogg:!!el.canPlayType?.('audio/ogg; codecs="vorbis"'),
  mp3:!!el.canPlayType?.('audio/mpeg')
 };
}
const SUPPORT=audioSupport();

function urlsFor(base){
 const urls=[];
 if(!MP3_ONLY.has(base)&&SUPPORT.ogg)urls.push(`${ROOT}${base}.ogg`);
 if(SUPPORT.mp3)urls.push(`${ROOT}${base}.mp3`);
 if(!MP3_ONLY.has(base)&&!urls.some(x=>x.endsWith('.ogg')))urls.push(`${ROOT}${base}.ogg`);
 if(!urls.some(x=>x.endsWith('.mp3')))urls.push(`${ROOT}${base}.mp3`);
 return urls;
}

class PokerAudio{
 constructor(){
  this.context=null;
  this.master=null;
  this.buffers=new Map();
  this.loading=new Map();
  this.lastPick=new Map();
  this.unlocked=false;
  this.unlocking=null;
  this.muted=storageGet('crashout_sfx_muted','0')==='1';
  this.volume=clamp(Number(storageGet('crashout_sfx_volume','0.72'))||0.72,0,1);
 }
 ensureContext(){
  if(typeof window==='undefined')return null;
  if(this.context)return this.context;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  try{
   this.context=new Ctx();
   this.master=this.context.createGain();
   this.master.gain.value=this.muted?0:this.volume;
   this.master.connect(this.context.destination);
   return this.context;
  }catch{return null}
 }
 async unlock(){
  if(this.unlocked)return true;
  if(this.unlocking)return this.unlocking;
  this.unlocking=(async()=>{
   const ctx=this.ensureContext();
   if(!ctx){
    this.unlocked=true;
    return true;
   }
   try{
    if(ctx.state==='suspended')await ctx.resume();
    const silent=ctx.createBuffer(1,1,ctx.sampleRate);
    const source=ctx.createBufferSource();
    source.buffer=silent;
    source.connect(this.master);
    source.start(0);
    this.unlocked=ctx.state==='running';
    if(this.unlocked)this.preload();
    return this.unlocked;
   }catch{return false}
  })().finally(()=>{this.unlocking=null});
  return this.unlocking;
 }
 resume(){
  const ctx=this.context;
  if(this.unlocked&&ctx?.state==='suspended')ctx.resume().catch(()=>{});
 }
 async decode(data){
  const ctx=this.context;
  if(!ctx)return null;
  return new Promise((resolve,reject)=>{
   try{ctx.decodeAudioData(data.slice(0),resolve,reject)}catch(error){reject(error)}
  });
 }
 async load(base){
  if(this.buffers.has(base))return this.buffers.get(base);
  if(this.loading.has(base))return this.loading.get(base);
  const promise=(async()=>{
   const ctx=this.ensureContext();
   if(!ctx)return null;
   for(const url of urlsFor(base)){
    try{
     const response=await fetch(url,{cache:'force-cache'});
     if(!response.ok)continue;
     const buffer=await this.decode(await response.arrayBuffer());
     if(buffer){this.buffers.set(base,buffer);return buffer}
    }catch{}
   }
   return null;
  })().finally(()=>this.loading.delete(base));
  this.loading.set(base,promise);
  return promise;
 }
 preload(){for(const base of PRELOAD)this.load(base).catch(()=>{})}
 pick(group){
  const choices=GROUPS[group]||[];
  if(!choices.length)return null;
  if(choices.length===1)return choices[0];
  const previous=this.lastPick.get(group);
  let choice=choices[Math.floor(Math.random()*choices.length)];
  if(choice===previous)choice=choices[(choices.indexOf(choice)+1+Math.floor(Math.random()*(choices.length-1)))%choices.length];
  this.lastPick.set(group,choice);
  return choice;
 }
 play(group,{volume=1,delay=0}={}){
  const base=this.pick(group);
  if(!base||this.muted)return;
  if(!this.unlocked){
   if(this.unlocking)this.unlocking.then(ok=>{if(ok)this.playBase(base,{volume,delay})});
   return;
  }
  this.playBase(base,{volume,delay});
 }
 async playBase(base,{volume=1,delay=0}={}){
  const ctx=this.ensureContext();
  if(!ctx){this.playHtml(base,volume,delay);return}
  if(ctx.state==='suspended'){
   try{await ctx.resume()}catch{return}
  }
  const buffer=await this.load(base);
  if(!buffer||this.muted||ctx.state!=='running')return;
  try{
   const source=ctx.createBufferSource(),gain=ctx.createGain();
   source.buffer=buffer;
   gain.gain.value=clamp(Number(volume)||0,0,1.5);
   source.connect(gain);
   gain.connect(this.master);
   source.start(ctx.currentTime+Math.max(0,Number(delay)||0)/1000);
  }catch{}
 }
 playHtml(base,volume=1,delay=0){
  if(typeof Audio==='undefined')return;
  const attempt=(urls,index=0)=>{
   if(index>=urls.length)return;
   const el=new Audio(urls[index]);
   el.preload='auto';
   el.volume=clamp(this.volume*volume,0,1);
   el.addEventListener('error',()=>attempt(urls,index+1),{once:true});
   const go=()=>el.play().catch(()=>attempt(urls,index+1));
   if(delay>0)setTimeout(go,delay);else go();
  };
  attempt(urlsFor(base));
 }
 setMuted(value){
  this.muted=!!value;
  try{localStorage.setItem('crashout_sfx_muted',this.muted?'1':'0')}catch{}
  if(this.master)this.master.gain.value=this.muted?0:this.volume;
 }
 setVolume(value){
  this.volume=clamp(Number(value)||0,0,1);
  try{localStorage.setItem('crashout_sfx_volume',String(this.volume))}catch{}
  if(this.master&&!this.muted)this.master.gain.value=this.volume;
 }
}

export const pokerAudio=new PokerAudio();

let unlockInstalled=false;
export function installPokerAudioUnlock(){
 if(unlockInstalled||typeof window==='undefined'||typeof document==='undefined')return;
 unlockInstalled=true;
 const events=['pointerdown','touchstart','keydown','click'];
 const activate=()=>{if(pokerAudio.unlocked)pokerAudio.resume();else pokerAudio.unlock().catch(()=>{})};
 events.forEach(type=>window.addEventListener(type,activate,{capture:true,passive:true}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pokerAudio.resume()});
 pokerAudio.unlock().catch(()=>{});
}

function mapAction(entry){
 const type=String(entry?.type||'').toLowerCase(),text=String(entry?.text||'').toLowerCase();
 if(type==='hand')return[{group:'handStart',volume:.72,delay:0},{group:'deal',volume:.86,delay:110}];
 if(type==='fold'||type==='muck')return[{group:'fold',volume:.82,delay:0}];
 if(type==='check')return[{group:'check',volume:.72,delay:0}];
 if(type==='call')return[{group:'call',volume:.80,delay:0}];
 if(type==='raise')return[{group:'raise',volume:.84,delay:0}];
 if(type==='allin')return[{group:'allin',volume:.92,delay:0}];
 if(type==='showhand')return[{group:'show',volume:.78,delay:0}];
 if(type==='timeout'){
  if(text.includes('fold'))return[{group:'fold',volume:.76,delay:0}];
  if(text.includes('check'))return[{group:'check',volume:.66,delay:0}];
 }
 if(type==='sitout'&&text.includes('fold'))return[{group:'fold',volume:.72,delay:0}];
 return[];
}

function resultWinnerIds(result){
 const ids=[];
 for(const award of result?.awards||[])if(award?.playerId)ids.push(String(award.playerId));
 if(!ids.length)for(const pot of result?.pots||[])for(const id of pot?.winnerIds||[])if(id)ids.push(String(id));
 return[...new Set(ids)];
}

function boardEvents(previousLength,nextLength,startDelay=0){
 const events=[],from=Math.max(0,Number(previousLength)||0),to=Math.max(0,Number(nextLength)||0);
 let delay=startDelay;
 if(from<3&&to>=3){events.push({group:'flop',volume:.88,delay});delay+=230}
 if(from<4&&to>=4){events.push({group:'turn',volume:.86,delay});delay+=190}
 if(from<5&&to>=5){events.push({group:'river',volume:.88,delay});delay+=230}
 return{events,endDelay:delay};
}

export function usePokerTableSfx(tableKey,state){
 const seenActions=useRef(new Set()),lastState=useRef(null),activeKey=useRef(tableKey),showdownHands=useRef(new Set()),boardMax=useRef({hand:0,count:0});
 useEffect(()=>{
  if(activeKey.current!==tableKey){
   activeKey.current=tableKey;
   seenActions.current=new Set();
   lastState.current=null;
   showdownHands.current=new Set();
   boardMax.current={hand:0,count:0};
  }
  if(!state)return;
  const previous=lastState.current;
  const log=Array.isArray(state.actionLog)?state.actionLog:[];
  if(!previous){
   for(const entry of log)if(entry?.id)seenActions.current.add(entry.id);
   boardMax.current={hand:Number(state.handNumber)||0,count:Array.isArray(state.board)?state.board.length:0};
   if(state.street==='showdown')showdownHands.current.add(Number(state.handNumber)||0);
   lastState.current=state;
   return;
  }

  const events=[];
  let actionDelay=0;
  for(const entry of log){
   const id=entry?.id;
   if(!id||seenActions.current.has(id))continue;
   seenActions.current.add(id);
   for(const event of mapAction(entry))events.push({...event,delay:(event.delay||0)+actionDelay});
   actionDelay+=95;
  }

  const hand=Number(state.handNumber)||0;
  const nextBoard=Array.isArray(state.board)?state.board.length:0;
  if(boardMax.current.hand!==hand)boardMax.current={hand,count:0};
  const fromBoard=boardMax.current.count;
  let timeline=Math.max(0,actionDelay);
  if(nextBoard>fromBoard){
   const board=boardEvents(fromBoard,nextBoard,timeline);
   events.push(...board.events);
   timeline=board.endDelay;
   boardMax.current.count=nextBoard;
  }else boardMax.current.count=Math.max(boardMax.current.count,nextBoard);

  if(state.street==='showdown'&&!showdownHands.current.has(hand)){
   showdownHands.current.add(hand);
   const result=state.lastResult||{};
   const revealed=Array.isArray(result.revealed)?result.revealed.length:0;
   if(revealed){
    events.push({group:'showdown',volume:.82,delay:timeline+90});
    timeline+=300;
   }else timeline+=100;
   const winners=resultWinnerIds(result);
   const settled=Math.max(0,Number(result.settledPot)||0),bb=Math.max(1,Number(state.bigBlind)||1);
   const resultGroup=winners.length>1?'splitPot':settled>=bb*20?'bigPot':'pot';
   events.push({group:resultGroup,volume:.88,delay:timeline+120});
   if(Array.isArray(result.knockouts)&&result.knockouts.length)events.push({group:'bust',volume:.74,delay:timeline+430});
  }

  for(const event of events)pokerAudio.play(event.group,{volume:event.volume,delay:event.delay});
  lastState.current=state;
 },[tableKey,state]);
}

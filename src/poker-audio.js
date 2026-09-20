import{useEffect,useRef}from'react';

const ROOT='/assets/sfx/';
const MP3_ONLY=new Set();

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

const PRELOAD=[...new Set(Object.values(GROUPS).flat())];
const MAX_PENDING_AGE_MS=1800;

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
const IS_APPLE_TOUCH=typeof navigator!=='undefined'&&(
 /iPhone|iPad|iPod/i.test(navigator.userAgent||'')||
 ((navigator.platform==='MacIntel'||/Macintosh/i.test(navigator.userAgent||''))&&Number(navigator.maxTouchPoints||0)>1)
);
const IS_TELEGRAM_WEBVIEW=typeof window!=='undefined'&&!!window.Telegram?.WebApp;

function setPlaybackAudioSession(){
 try{
  if(navigator?.audioSession&&'type'in navigator.audioSession)navigator.audioSession.type='playback';
 }catch{}
}

function silentWavUrl(){
 if(typeof Blob==='undefined'||typeof URL==='undefined')return'';
 const sampleRate=8000,samples=sampleRate,bytes=44+samples*2,buffer=new ArrayBuffer(bytes),view=new DataView(buffer);
 const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
 write(0,'RIFF');view.setUint32(4,bytes-8,true);write(8,'WAVE');write(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
 view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples*2,true);
 return URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
}

function mediaUrlsFor(base){
 const urls=[];
 if(!MP3_ONLY.has(base)&&SUPPORT.ogg)urls.push(`${ROOT}${base}.ogg`);
 if(SUPPORT.mp3)urls.push(`${ROOT}${base}.mp3`);
 if(!MP3_ONLY.has(base)&&!urls.some(x=>x.endsWith('.ogg')))urls.push(`${ROOT}${base}.ogg`);
 if(!urls.some(x=>x.endsWith('.mp3')))urls.push(`${ROOT}${base}.mp3`);
 return urls;
}

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
  this.pending=[];
  this.mediaPreloads=new Map();
  this.mediaPrime=null;
  this.mediaPrimeUrl='';
  this.mediaPool=[];
  this.mediaPoolIndex=0;
  this.mediaPoolReady=false;
  this.preferMedia=IS_APPLE_TOUCH||IS_TELEGRAM_WEBVIEW;
  this.unlocked=false;
  this.unlocking=null;
  this.muted=storageGet('crashout_sfx_muted','0')==='1';
  this.volume=clamp(Number(storageGet('crashout_sfx_volume','0.82'))||0.82,0,1);
 }
 createContext(){
  if(this.context)return this.context;
  if(typeof window==='undefined')return null;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  try{
   const ctx=new Ctx();
   const master=ctx.createGain();
   master.gain.value=this.muted?0:this.volume;
   master.connect(ctx.destination);
   this.context=ctx;
   this.master=master;
   return ctx;
  }catch{return null}
 }
 ensureMediaPrime(){
  if(!this.preferMedia||typeof Audio==='undefined')return null;
  if(this.mediaPrime)return this.mediaPrime;
  const url=silentWavUrl();
  if(!url)return null;
  const el=new Audio(url);
  el.loop=true;
  el.preload='auto';
  el.volume=0.001;
  el.setAttribute('playsinline','');
  this.mediaPrime=el;
  this.mediaPrimeUrl=url;
  return el;
 }
 ensureMediaPool(){
  if(!this.preferMedia||typeof Audio==='undefined')return[];
  if(this.mediaPool.length)return this.mediaPool;
  const url=this.mediaPrimeUrl||silentWavUrl();
  if(!url)return[];
  if(!this.mediaPrimeUrl)this.mediaPrimeUrl=url;
  for(let i=0;i<8;i++){
   const el=new Audio(url);
   el.preload='auto';
   el.loop=true;
   el.volume=0.001;
   el.setAttribute('playsinline','');
   this.mediaPool.push(el);
  }
  return this.mediaPool;
 }
 async primeMediaPoolFromGesture(){
  const pool=this.ensureMediaPool();
  if(!pool.length)return false;
  const starts=[];
  let started=0;
  for(const el of pool){
   try{
    const p=el.play();
    started++;
    if(p&&typeof p.then==='function')starts.push(p.catch(()=>null));
   }catch{}
  }
  if(starts.length)await Promise.allSettled(starts);
  this.mediaPoolReady=started>0;
  return this.mediaPoolReady;
 }
 nextMediaChannel(){
  if(!this.mediaPoolReady||!this.mediaPool.length)return null;
  const el=this.mediaPool[this.mediaPoolIndex%this.mediaPool.length];
  this.mediaPoolIndex=(this.mediaPoolIndex+1)%this.mediaPool.length;
  return el;
 }
 preloadMedia(){
  if(typeof Audio==='undefined')return;
  for(const base of PRELOAD){
   if(this.mediaPreloads.has(base))continue;
   const url=mediaUrlsFor(base)[0];
   if(!url)continue;
   const el=new Audio(url);
   el.preload='auto';
   el.setAttribute('playsinline','');
   this.mediaPreloads.set(base,el);
   try{el.load()}catch{}
  }
 }
 async unlockFromGesture(){
  setPlaybackAudioSession();
  if(this.preferMedia){
   const prime=this.ensureMediaPrime();
   try{
    const primePlay=prime?.paused?prime.play():null;
    const poolPromise=this.primeMediaPoolFromGesture();
    if(primePlay&&typeof primePlay.then==='function')await primePlay;
    await poolPromise;
    this.unlocked=true;
    this.preloadMedia();
    this.flushPending();
    return true;
   }catch{
    this.unlocked=false;
   }
  }
  if(this.unlocked&&(!this.context||this.context.state==='running')){
   this.flushPending();
   return true;
  }
  if(this.unlocking)return this.unlocking;
  this.unlocking=(async()=>{
   const ctx=this.createContext();
   if(!ctx){
    this.unlocked=true;
    this.flushPending();
    return true;
   }
   try{
    if(ctx.state!=='running')await ctx.resume();
    if(ctx.state!=='running')return false;
    const silent=ctx.createBuffer(1,1,ctx.sampleRate);
    const source=ctx.createBufferSource();
    source.buffer=silent;
    source.connect(this.master);
    source.start(0);
    this.unlocked=true;
    this.preload();
    this.flushPending();
    return true;
   }catch{
    this.unlocked=false;
    return false;
   }
  })().finally(()=>{this.unlocking=null});
  return this.unlocking;
 }
 resume(){
  setPlaybackAudioSession();
  if(this.preferMedia&&this.mediaPrime?.paused){
   this.mediaPrime.play().then(()=>this.flushPending()).catch(()=>{});
  }
  const ctx=this.context;
  if(!this.unlocked||!ctx||ctx.state!=='suspended')return;
  ctx.resume().then(()=>{
   if(ctx.state==='running')this.flushPending();
  }).catch(()=>{});
 }
 async decode(data){
  const ctx=this.context;
  if(!ctx)return null;
  if(typeof ctx.decodeAudioData!=='function')return null;
  try{
   const copy=data.slice(0);
   const decoded=ctx.decodeAudioData(copy);
   if(decoded&&typeof decoded.then==='function')return await decoded;
   return await new Promise((resolve,reject)=>ctx.decodeAudioData(copy,resolve,reject));
  }catch{return null}
 }
 async load(base){
  if(this.buffers.has(base))return this.buffers.get(base);
  if(this.loading.has(base))return this.loading.get(base);
  if(!this.context)return null;
  const promise=(async()=>{
   for(const url of urlsFor(base)){
    try{
     const response=await fetch(url,{cache:'force-cache'});
     if(!response.ok)continue;
     const buffer=await this.decode(await response.arrayBuffer());
     if(buffer){
      this.buffers.set(base,buffer);
      return buffer;
     }
    }catch{}
   }
   return null;
  })().finally(()=>this.loading.delete(base));
  this.loading.set(base,promise);
  return promise;
 }
 preload(){
  if(!this.unlocked||!this.context)return;
  for(const base of PRELOAD)this.load(base).catch(()=>{});
 }
 pick(group){
  const choices=GROUPS[group]||[];
  if(!choices.length)return null;
  if(choices.length===1)return choices[0];
  const previous=this.lastPick.get(group);
  let choice=choices[Math.floor(Math.random()*choices.length)];
  if(choice===previous){
   const others=choices.filter(item=>item!==previous);
   choice=others[Math.floor(Math.random()*others.length)];
  }
  this.lastPick.set(group,choice);
  return choice;
 }
 queue(base,volume,delay){
  const now=Date.now();
  this.pending=this.pending.filter(item=>now-item.queuedAt<=MAX_PENDING_AGE_MS);
  this.pending.push({base,volume,delay,queuedAt:now});
  if(this.pending.length>10)this.pending=this.pending.slice(-10);
 }
 flushPending(){
  if(!this.unlocked||this.muted)return;
  const now=Date.now(),items=this.pending;
  this.pending=[];
  for(const item of items){
   const age=now-item.queuedAt;
   if(age>MAX_PENDING_AGE_MS)continue;
   this.playBase(item.base,{
    volume:item.volume,
    delay:Math.max(0,(Number(item.delay)||0)-age)
   });
  }
 }
 play(group,{volume=1,delay=0}={}){
  const base=this.pick(group);
  if(!base||this.muted)return;
  if(!this.unlocked||(this.context&&this.context.state!=='running')){
   this.queue(base,volume,delay);
   return;
  }
  this.playBase(base,{volume,delay});
 }
 async playBase(base,{volume=1,delay=0}={}){
  if(this.muted)return;
  if(this.preferMedia){
   this.playHtml(base,volume,delay);
   return;
  }
  const ctx=this.context;
  if(!ctx){
   this.playHtml(base,volume,delay);
   return;
  }
  if(ctx.state!=='running'){
   this.queue(base,volume,delay);
   return;
  }
  const buffer=await this.load(base);
  if(!buffer||this.muted||ctx.state!=='running')return;
  try{
   const source=ctx.createBufferSource();
   const gain=ctx.createGain();
   source.buffer=buffer;
   gain.gain.value=clamp(Number(volume)||0,0,1.5);
   source.connect(gain);
   gain.connect(this.master);
   source.start(ctx.currentTime+Math.max(0,Number(delay)||0)/1000);
  }catch{}
 }
 playHtml(base,volume=1,delay=0){
  if(typeof Audio==='undefined'||this.muted)return;
  const urls=this.preferMedia?mediaUrlsFor(base):urlsFor(base);
  const pooled=this.preferMedia?this.nextMediaChannel():null;
  const attempt=(index,el=pooled)=>{
   if(index>=urls.length)return;
   const channel=el||new Audio();
   try{channel.pause()}catch{}
   channel.loop=false;
   channel.preload='auto';
   channel.src=urls[index];
   channel.volume=clamp(this.volume*volume,0,1);
   channel.setAttribute?.('playsinline','');
   const go=()=>{
    try{channel.currentTime=0}catch{}
    channel.play().catch(()=>{
     if(index+1<urls.length)attempt(index+1,channel);
     else if(this.preferMedia)this.mediaPoolReady=false;
    });
   };
   if(delay>0)setTimeout(go,delay);else go();
  };
  attempt(0);
 }
 setMuted(value){
  this.muted=!!value;
  try{localStorage.setItem('crashout_sfx_muted',this.muted?'1':'0')}catch{}
  if(this.master)this.master.gain.value=this.muted?0:this.volume;
  if(!this.muted)this.flushPending();
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
 const activate=()=>{pokerAudio.unlockFromGesture().catch(()=>{})};
 window.addEventListener('pointerdown',activate,{capture:true,passive:true});
 window.addEventListener('touchend',activate,{capture:true,passive:true});
 window.addEventListener('click',activate,{capture:true,passive:true});
 window.addEventListener('keydown',activate,{capture:true});
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')pokerAudio.resume();
 });
 const tg=window.Telegram?.WebApp;
 try{
  tg?.onEvent?.('activated',()=>pokerAudio.resume());
  tg?.onEvent?.('deactivated',()=>{});
 }catch{}
}

function mapAction(entry){
 const type=String(entry?.type||'').toLowerCase();
 const text=String(entry?.text||'').toLowerCase();
 if(type==='hand')return[{group:'handStart',volume:.78,delay:0},{group:'deal',volume:.94,delay:110}];
 if(type==='fold'||type==='muck')return[{group:'fold',volume:.92,delay:0}];
 if(type==='check')return[{group:'check',volume:.86,delay:0}];
 if(type==='call')return[{group:'call',volume:.92,delay:0}];
 if(type==='raise')return[{group:'raise',volume:.96,delay:0}];
 if(type==='allin')return[{group:'allin',volume:1,delay:0}];
 if(type==='showhand')return[{group:'show',volume:.9,delay:0}];
 if(type==='timeout'){
  if(text.includes('fold'))return[{group:'fold',volume:.86,delay:0}];
  if(text.includes('check'))return[{group:'check',volume:.8,delay:0}];
 }
 if(type==='sitout'&&text.includes('fold'))return[{group:'fold',volume:.82,delay:0}];
 return[];
}

function resultWinnerIds(result){
 const ids=[];
 for(const award of result?.awards||[])if(award?.playerId)ids.push(String(award.playerId));
 if(!ids.length){
  for(const pot of result?.pots||[]){
   for(const id of pot?.winnerIds||[])if(id)ids.push(String(id));
  }
 }
 return[...new Set(ids)];
}

function boardEvents(previousLength,nextLength,startDelay=0){
 const events=[];
 const from=Math.max(0,Number(previousLength)||0);
 const to=Math.max(0,Number(nextLength)||0);
 let delay=startDelay;
 if(from<3&&to>=3){events.push({group:'flop',volume:.98,delay});delay+=230}
 if(from<4&&to>=4){events.push({group:'turn',volume:.96,delay});delay+=190}
 if(from<5&&to>=5){events.push({group:'river',volume:.98,delay});delay+=230}
 return{events,endDelay:delay};
}

export function usePokerTableSfx(tableKey,state){
 const seenActions=useRef(new Set());
 const lastState=useRef(null);
 const activeKey=useRef(tableKey);
 const showdownHands=useRef(new Set());
 const boardMax=useRef({hand:0,count:0});

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
   boardMax.current={
    hand:Number(state.handNumber)||0,
    count:Array.isArray(state.board)?state.board.length:0
   };
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
   for(const event of mapAction(entry)){
    events.push({...event,delay:(event.delay||0)+actionDelay});
   }
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
  }else{
   boardMax.current.count=Math.max(boardMax.current.count,nextBoard);
  }

  if(state.street==='showdown'&&!showdownHands.current.has(hand)){
   showdownHands.current.add(hand);
   const result=state.lastResult||{};
   const revealed=Array.isArray(result.revealed)?result.revealed.length:0;

   if(revealed){
    events.push({group:'showdown',volume:.94,delay:timeline+90});
    timeline+=300;
   }else{
    timeline+=100;
   }

   const winners=resultWinnerIds(result);
   const settled=Math.max(0,Number(result.settledPot)||0);
   const bb=Math.max(1,Number(state.bigBlind)||1);
   const resultGroup=winners.length>1?'splitPot':settled>=bb*20?'bigPot':'pot';
   events.push({group:resultGroup,volume:.98,delay:timeline+120});

   if(Array.isArray(result.knockouts)&&result.knockouts.length){
    events.push({group:'bust',volume:.86,delay:timeline+430});
   }
  }

  for(const event of events){
   pokerAudio.play(event.group,{volume:event.volume,delay:event.delay});
  }

  lastState.current=state;
 },[tableKey,state]);
}

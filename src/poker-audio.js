import{useEffect,useRef}from'react';

const ROOT='/assets/sfx/';
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

const IS_TELEGRAM=typeof window!=='undefined'&&!!window.Telegram?.WebApp;
const MAX_PENDING_AGE_MS=1200;
const MAX_ACTIVE_SOURCES=6;

function storageGet(key,fallback){
 try{const value=localStorage.getItem(key);return value==null?fallback:value}catch{return fallback}
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function setPlaybackAudioSession(){
 try{
  if(navigator?.audioSession&&'type'in navigator.audioSession)navigator.audioSession.type='playback';
 }catch{}
}
function formatUrls(base){
 return[
  `${ROOT}${base}.ogg`,
  `${ROOT}${base}.mp3`
 ];
}

class PokerAudio{
 constructor(){
  this.context=null;
  this.master=null;
  this.buffers=new Map();
  this.loading=new Map();
  this.lastPick=new Map();
  this.pending=[];
  this.active=[];
  this.unlocked=false;
  this.unlocking=null;
  this.fallback=null;
  this.telegramMedia=null;
  this.telegramQueue=[];
  this.telegramBusy=false;
  this.telegramPrimed=false;
  this.muted=storageGet('crashout_sfx_muted','0')==='1';
  this.volume=clamp(Number(storageGet('crashout_sfx_volume','0.82'))||0.82,0,1);
 }
 ensureTelegramMedia(){
  if(!IS_TELEGRAM||typeof Audio==='undefined')return null;
  if(this.telegramMedia)return this.telegramMedia;
  const el=new Audio();
  el.preload='metadata';
  el.setAttribute('playsinline','');
  el.crossOrigin='anonymous';
  el.addEventListener('ended',()=>{
   this.telegramBusy=false;
   this.drainTelegramQueue();
  });
  el.addEventListener('error',()=>{
   this.telegramBusy=false;
   this.drainTelegramQueue(true);
  });
  this.telegramMedia=el;
  return el;
 }
 async primeTelegramFromGesture(){
  const el=this.ensureTelegramMedia();
  if(!el)return false;
  try{
   el.src=`${ROOT}table/check_tap_01.ogg`;
   el.volume=0.0001;
   el.currentTime=0;
   await el.play();
   el.pause();
   try{el.currentTime=0}catch{}
   this.telegramPrimed=true;
   return true;
  }catch{
   try{
    el.src=`${ROOT}table/check_tap_01.mp3`;
    el.volume=0.0001;
    el.currentTime=0;
    await el.play();
    el.pause();
    try{el.currentTime=0}catch{}
    this.telegramPrimed=true;
    return true;
   }catch{
    this.telegramPrimed=false;
    return false;
   }
  }
 }
 enqueueTelegram(base,volume=1,delay=0){
  const now=Date.now();
  this.telegramQueue.push({base,volume,delay,queuedAt:now,formatIndex:0});
  if(this.telegramQueue.length>6)this.telegramQueue=this.telegramQueue.slice(-6);
  this.drainTelegramQueue();
 }
 drainTelegramQueue(retryCurrent=false){
  if(!IS_TELEGRAM||this.muted||!this.telegramPrimed||this.telegramBusy)return;
  const el=this.ensureTelegramMedia();
  if(!el)return;
  const item=this.telegramQueue.shift();
  if(!item)return;

  const urls=formatUrls(item.base);
  const playAt=index=>{
   if(index>=urls.length){
    this.telegramBusy=false;
    this.drainTelegramQueue();
    return;
   }
   const age=Date.now()-item.queuedAt;
   if(age>1800){
    this.telegramBusy=false;
    this.drainTelegramQueue();
    return;
   }
   this.telegramBusy=true;
   try{
    el.pause();
    el.src=urls[index];
    el.preload='auto';
    el.volume=clamp(this.volume*item.volume,0,1);
    const go=()=>{
     try{el.currentTime=0}catch{}
     const p=el.play();
     if(p&&typeof p.catch==='function'){
      p.catch(()=>{
       this.telegramBusy=false;
       playAt(index+1);
      });
     }
    };
    const remaining=Math.max(0,(Number(item.delay)||0)-age);
    if(remaining>0)setTimeout(go,remaining);else go();
   }catch{
    this.telegramBusy=false;
    playAt(index+1);
   }
  };
  playAt(retryCurrent?1:0);
 }
 createContext(){
  if(this.context)return this.context;
  if(typeof window==='undefined')return null;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  try{
   setPlaybackAudioSession();
   const ctx=new Ctx({latencyHint:'interactive'});
   const master=ctx.createGain();
   master.gain.value=this.muted?0:this.volume;
   master.connect(ctx.destination);
   this.context=ctx;
   this.master=master;
   return ctx;
  }catch{return null}
 }
 async unlockFromGesture(){
  setPlaybackAudioSession();
  if(IS_TELEGRAM){
   if(this.telegramPrimed){
    this.unlocked=true;
    this.drainTelegramQueue();
    return true;
   }
   const ok=await this.primeTelegramFromGesture();
   this.unlocked=ok;
   if(ok)this.drainTelegramQueue();
   return ok;
  }
  if(this.unlocked){
   this.resume();
   this.flushPending();
   return true;
  }
  if(this.unlocking)return this.unlocking;
  this.unlocking=(async()=>{
   const ctx=this.createContext();
   if(!ctx){
    this.unlocked=true;
    this.ensureFallback();
    this.flushPending();
    return true;
   }
   try{
    if(ctx.state!=='running')await ctx.resume();
    if(ctx.state!=='running')return false;
    const source=ctx.createBufferSource();
    source.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
    source.connect(this.master);
    source.start();
    this.unlocked=true;
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
  if(IS_TELEGRAM){
   if(this.telegramPrimed)this.drainTelegramQueue();
   return;
  }
  const ctx=this.context;
  if(!this.unlocked||!ctx||ctx.state!=='suspended')return;
  ctx.resume().then(()=>this.flushPending()).catch(()=>{});
 }
 async decode(arrayBuffer){
  const ctx=this.context;
  if(!ctx)return null;
  try{
   return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }catch{return null}
 }
 async load(base){
  if(this.buffers.has(base))return this.buffers.get(base);
  if(this.loading.has(base))return this.loading.get(base);
  const ctx=this.context;
  if(!ctx)return null;

  const promise=(async()=>{
   for(const url of formatUrls(base)){
    try{
     const response=await fetch(url,{cache:'force-cache'});
     if(!response.ok)continue;
     const decoded=await this.decode(await response.arrayBuffer());
     if(decoded){
      this.buffers.set(base,decoded);
      return decoded;
     }
    }catch{}
   }
   return null;
  })().finally(()=>this.loading.delete(base));

  this.loading.set(base,promise);
  return promise;
 }
 pick(group){
  const choices=GROUPS[group]||[];
  if(!choices.length)return null;
  if(choices.length===1)return choices[0];
  const previous=this.lastPick.get(group);
  let choice=choices[Math.floor(Math.random()*choices.length)];
  if(choice===previous){
   const alternatives=choices.filter(item=>item!==previous);
   choice=alternatives[Math.floor(Math.random()*alternatives.length)];
  }
  this.lastPick.set(group,choice);
  return choice;
 }
 queue(base,volume,delay){
  const now=Date.now();
  this.pending=this.pending.filter(item=>now-item.queuedAt<=MAX_PENDING_AGE_MS);
  this.pending.push({base,volume,delay,queuedAt:now});
  if(this.pending.length>8)this.pending=this.pending.slice(-8);
 }
 flushPending(){
  if(!this.unlocked||this.muted)return;
  const now=Date.now(),items=this.pending;
  this.pending=[];
  for(const item of items){
   const age=now-item.queuedAt;
   if(age>MAX_PENDING_AGE_MS)continue;
   if(IS_TELEGRAM){
    this.enqueueTelegram(item.base,item.volume,Math.max(0,(Number(item.delay)||0)-age));
   }else{
    this.playBase(item.base,{
     volume:item.volume,
     delay:Math.max(0,(Number(item.delay)||0)-age)
    });
   }
  }
 }
 play(group,{volume=1,delay=0}={}){
  const base=this.pick(group);
  if(!base||this.muted)return;
  if(IS_TELEGRAM){
   if(!this.unlocked||!this.telegramPrimed){
    this.queue(base,volume,delay);
    return;
   }
   this.enqueueTelegram(base,volume,delay);
   return;
  }
  const ctx=this.context;
  if(!this.unlocked||(ctx&&ctx.state!=='running')){
   this.queue(base,volume,delay);
   return;
  }
  this.playBase(base,{volume,delay});
 }
 trimActive(){
  this.active=this.active.filter(item=>!item.ended);
  while(this.active.length>=MAX_ACTIVE_SOURCES){
   const oldest=this.active.shift();
   try{oldest?.source?.stop()}catch{}
  }
 }
 async playBase(base,{volume=1,delay=0}={}){
  if(this.muted)return;
  const ctx=this.context;
  if(!ctx){
   this.playFallback(base,volume,delay);
   return;
  }
  if(ctx.state!=='running'){
   this.queue(base,volume,delay);
   return;
  }

  const buffer=await this.load(base);
  if(!buffer||this.muted||ctx.state!=='running')return;

  try{
   this.trimActive();
   const source=ctx.createBufferSource();
   const gain=ctx.createGain();
   const entry={source,ended:false};
   source.buffer=buffer;
   gain.gain.value=clamp(Number(volume)||0,0,1.25);
   source.connect(gain);
   gain.connect(this.master);
   source.onended=()=>{
    entry.ended=true;
    try{source.disconnect();gain.disconnect()}catch{}
   };
   this.active.push(entry);
   source.start(ctx.currentTime+Math.max(0,Number(delay)||0)/1000);
  }catch{}
 }
 ensureFallback(){
  if(this.fallback||typeof Audio==='undefined')return this.fallback;
  const el=new Audio();
  el.preload='none';
  el.setAttribute('playsinline','');
  this.fallback=el;
  return el;
 }
 playFallback(base,volume=1,delay=0){
  const el=this.ensureFallback();
  if(!el||this.muted)return;
  const urls=formatUrls(base);
  const attempt=index=>{
   if(index>=urls.length)return;
   try{
    el.pause();
    el.src=urls[index];
    el.volume=clamp(this.volume*volume,0,1);
    el.currentTime=0;
    const go=()=>el.play().catch(()=>attempt(index+1));
    if(delay>0)setTimeout(go,delay);else go();
   }catch{attempt(index+1)}
  };
  attempt(0);
 }
 setMuted(value){
  this.muted=!!value;
  try{localStorage.setItem('crashout_sfx_muted',this.muted?'1':'0')}catch{}
  if(this.master)this.master.gain.value=this.muted?0:this.volume;
  if(this.muted){
   for(const item of this.active){try{item.source.stop()}catch{}}
   this.active=[];
   this.telegramQueue=[];
   this.telegramBusy=false;
   try{this.telegramMedia?.pause()}catch{}
  }else this.flushPending();
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

 if(IS_TELEGRAM){
  try{window.Telegram?.WebApp?.onEvent?.('activated',()=>pokerAudio.resume())}catch{}
 }
}

function mapAction(entry){
 const type=String(entry?.type||'').toLowerCase();
 const text=String(entry?.text||'').toLowerCase();

 if(type==='hand')return[{group:'handStart',volume:.74,delay:0},{group:'deal',volume:.88,delay:140}];
 if(type==='fold'||type==='muck')return[{group:'fold',volume:.86,delay:0}];
 if(type==='check')return[{group:'check',volume:.76,delay:0}];
 if(type==='call')return[{group:'call',volume:.84,delay:0}];
 if(type==='raise')return[{group:'raise',volume:.88,delay:0}];
 if(type==='allin')return[{group:'allin',volume:.92,delay:0}];
 if(type==='showhand')return[{group:'show',volume:.82,delay:0}];

 if(type==='timeout'){
  if(text.includes('fold'))return[{group:'fold',volume:.8,delay:0}];
  if(text.includes('check'))return[{group:'check',volume:.72,delay:0}];
 }
 if(type==='sitout'&&text.includes('fold'))return[{group:'fold',volume:.78,delay:0}];
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

 if(from<3&&to>=3){events.push({group:'flop',volume:.9,delay});delay+=240}
 if(from<4&&to>=4){events.push({group:'turn',volume:.86,delay});delay+=200}
 if(from<5&&to>=5){events.push({group:'river',volume:.88,delay});delay+=220}

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
   actionDelay+=110;
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
    events.push({group:'showdown',volume:.86,delay:timeline+100});
    timeline+=320;
   }else{
    timeline+=120;
   }

   const winners=resultWinnerIds(result);
   const settled=Math.max(0,Number(result.settledPot)||0);
   const bb=Math.max(1,Number(state.bigBlind)||1);
   const resultGroup=winners.length>1?'splitPot':settled>=bb*20?'bigPot':'pot';

   events.push({group:resultGroup,volume:.9,delay:timeline+140});

   if(Array.isArray(result.knockouts)&&result.knockouts.length){
    events.push({group:'bust',volume:.8,delay:timeline+480});
   }
  }

  for(const event of events){
   pokerAudio.play(event.group,{volume:event.volume,delay:event.delay});
  }

  lastState.current=state;
 },[tableKey,state]);
}

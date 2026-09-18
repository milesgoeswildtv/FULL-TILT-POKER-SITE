const REPLAY_STEP_LIMIT=120;

function safeNumber(value){const n=Number(value);return Number.isFinite(n)?n:0}
function safeText(value,limit=220){return String(value??'').slice(0,limit)}
function clonePlayers(players=[]){return players.map(p=>({...p}))}

export function createHandReplay(data,now=Date.now()){
 if(!data||!Array.isArray(data.players))return null;
 const players=data.players.map((p,seatIndex)=>({p,seatIndex})).filter(({p})=>!p.eliminated&&Array.isArray(p.cards)&&p.cards.length===2).map(({p,seatIndex})=>({
  id:safeText(p.id,64),
  name:safeText(p.name,48),
  seatIndex,
  startingChips:Math.max(0,safeNumber(p.chips)+safeNumber(p.contributed))
 }));
 if(players.length<2)return null;
 return{
  handNumber:Math.max(0,Math.trunc(safeNumber(data.handNumber))),
  dealerIndex:Math.max(0,Math.trunc(safeNumber(data.dealerIndex))),
  smallBlind:Math.max(0,Math.trunc(safeNumber(data.smallBlind))),
  bigBlind:Math.max(0,Math.trunc(safeNumber(data.bigBlind))),
  ante:Math.max(0,Math.trunc(safeNumber(data.ante))),
  startedAt:Math.max(0,Math.trunc(safeNumber(now))),
  players,
  steps:[]
 };
}

export function appendReplayStep(replay,data,{type='state',text='',at=Date.now(),potOverride=null}={}){
 if(!replay||!data||Number(replay.handNumber)!==Number(data.handNumber))return replay;
 const ids=new Set((replay.players||[]).map(p=>String(p.id)));
 const players=(data.players||[]).map((p,seatIndex)=>({p,seatIndex})).filter(({p})=>ids.has(String(p.id))).map(({p,seatIndex})=>({
  id:safeText(p.id,64),
  name:safeText(p.name,48),
  seatIndex,
  chips:Math.max(0,Math.trunc(safeNumber(p.chips))),
  bet:Math.max(0,Math.trunc(safeNumber(p.bet))),
  contributed:Math.max(0,Math.trunc(safeNumber(p.contributed))),
  folded:!!p.folded,
  eliminated:!!p.eliminated,
  allIn:!p.folded&&!p.eliminated&&safeNumber(p.chips)<=0
 }));
 const step={
  index:(replay.steps||[]).length,
  at:Math.max(0,Math.trunc(safeNumber(at))),
  type:safeText(type,32)||'state',
  text:safeText(text),
  street:safeText(data.street,16)||'preflop',
  board:Array.isArray(data.board)?data.board.map(c=>safeText(c,4)).slice(0,5):[],
  pot:Math.max(0,Math.trunc(potOverride==null?safeNumber(data.pot):safeNumber(potOverride))),
  currentBet:Math.max(0,Math.trunc(safeNumber(data.currentBet))),
  turnPlayerId:data.players?.[data.turnIndex]?.id?safeText(data.players[data.turnIndex].id,64):null,
  players
 };
 replay.steps=[...(replay.steps||[]),step].slice(-REPLAY_STEP_LIMIT);
 replay.steps.forEach((item,index)=>{item.index=index});
 return replay;
}

export function cloneHandReplay(replay){
 if(!replay)return null;
 return{
  handNumber:Math.max(0,Math.trunc(safeNumber(replay.handNumber))),
  dealerIndex:Math.max(0,Math.trunc(safeNumber(replay.dealerIndex))),
  smallBlind:Math.max(0,Math.trunc(safeNumber(replay.smallBlind))),
  bigBlind:Math.max(0,Math.trunc(safeNumber(replay.bigBlind))),
  ante:Math.max(0,Math.trunc(safeNumber(replay.ante))),
  startedAt:Math.max(0,Math.trunc(safeNumber(replay.startedAt))),
  players:(replay.players||[]).map(p=>({
   id:safeText(p.id,64),
   name:safeText(p.name,48),
   seatIndex:Math.max(0,Math.trunc(safeNumber(p.seatIndex))),
   startingChips:Math.max(0,Math.trunc(safeNumber(p.startingChips)))
  })),
  steps:(replay.steps||[]).slice(-REPLAY_STEP_LIMIT).map((step,index)=>({
   index,
   at:Math.max(0,Math.trunc(safeNumber(step.at))),
   type:safeText(step.type,32)||'state',
   text:safeText(step.text),
   street:safeText(step.street,16)||'preflop',
   board:Array.isArray(step.board)?step.board.map(c=>safeText(c,4)).slice(0,5):[],
   pot:Math.max(0,Math.trunc(safeNumber(step.pot))),
   currentBet:Math.max(0,Math.trunc(safeNumber(step.currentBet))),
   turnPlayerId:step.turnPlayerId?safeText(step.turnPlayerId,64):null,
   players:clonePlayers(step.players||[]).map(p=>({
    id:safeText(p.id,64),
    name:safeText(p.name,48),
    seatIndex:Math.max(0,Math.trunc(safeNumber(p.seatIndex))),
    chips:Math.max(0,Math.trunc(safeNumber(p.chips))),
    bet:Math.max(0,Math.trunc(safeNumber(p.bet))),
    contributed:Math.max(0,Math.trunc(safeNumber(p.contributed))),
    folded:!!p.folded,
    eliminated:!!p.eliminated,
    allIn:!!p.allIn
   }))
  }))
 };
}

export function rabbitRunout(deck=[],board=[]){
 const draw=Array.isArray(deck)?[...deck]:[],full=Array.isArray(board)?[...board]:[];
 if(full.length>=5)return full.slice(0,5);
 while(full.length<5){
  if(!draw.length)throw Error('Rabbit runout deck exhausted before burn card.');
  draw.pop();
  const count=full.length===0?3:1;
  for(let i=0;i<count&&full.length<5;i++){
   const card=draw.pop();if(!card)throw Error('Rabbit runout deck exhausted before community card.');
   full.push(card);
  }
 }
 return full.slice(0,5);
}

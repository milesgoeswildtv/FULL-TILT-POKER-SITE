export function actionLogText({type,name,beforeBet=0,beforeChips=0,currentBet=0,amount=0}){
 const toCall=Math.max(0,currentBet-beforeBet),callPaid=Math.min(beforeChips,toCall),allInTarget=beforeBet+beforeChips;
 if(type==='fold')return`${name} folded`;
 if(type==='check')return`${name} checked`;
 if(type==='call')return callPaid<toCall?`${name} called all-in for ${callPaid.toLocaleString()}`:`${name} called ${callPaid.toLocaleString()}`;
 if(type==='raise'){const target=Math.min(Math.max(0,Number(amount)||0),allInTarget);return`${name} raised to ${target.toLocaleString()}`}
 if(type==='allin')return allInTarget>currentBet?`${name} went all-in to ${allInTarget.toLocaleString()}`:`${name} called all-in for ${beforeChips.toLocaleString()}`;
 return'';
}

const HISTORY_STREETS=new Set(['preflop','flop','turn','river','showdown']);
export function completedHandActionLog(log=[],handNumber,limit=80){
 const hand=Math.max(0,Math.trunc(Number(handNumber)||0)),items=Array.isArray(log)?log:[];
 return items.filter(item=>Math.max(0,Math.trunc(Number(item?.handNumber)||0))===hand).slice(-Math.max(1,Math.trunc(Number(limit)||80))).map((item,index)=>({
  id:String(item?.id||`history-${hand}-${index}`).slice(0,64),
  at:Math.max(0,Math.trunc(Number(item?.at)||0)),
  handNumber:hand,
  street:HISTORY_STREETS.has(String(item?.street||'').toLowerCase())?String(item.street).toLowerCase():'preflop',
  type:String(item?.type||'event').slice(0,32),
  text:String(item?.text||'').slice(0,220),
  playerId:item?.playerId?String(item.playerId).slice(0,64):null
 })).filter(item=>item.text);
}

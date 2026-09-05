export function actionLogText({type,name,beforeBet=0,beforeChips=0,currentBet=0,amount=0}){
 const toCall=Math.max(0,currentBet-beforeBet),callPaid=Math.min(beforeChips,toCall),allInTarget=beforeBet+beforeChips;
 if(type==='fold')return`${name} folded`;
 if(type==='check')return`${name} checked`;
 if(type==='call')return callPaid<toCall?`${name} called all-in for ${callPaid.toLocaleString()}`:`${name} called ${callPaid.toLocaleString()}`;
 if(type==='raise'){const target=Math.min(Math.max(0,Number(amount)||0),allInTarget);return`${name} raised to ${target.toLocaleString()}`}
 if(type==='allin')return allInTarget>currentBet?`${name} went all-in to ${allInTarget.toLocaleString()}`:`${name} called all-in for ${beforeChips.toLocaleString()}`;
 return'';
}

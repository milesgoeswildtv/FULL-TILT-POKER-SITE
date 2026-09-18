export const PRE_ACTIONS=new Set(['checkfold','check','callany']);

export function normalizePreAction(value){
 const kind=String(value||'').toLowerCase();
 return PRE_ACTIONS.has(kind)?kind:null;
}

export function resolvePreAction(kind,state,me){
 kind=normalizePreAction(kind);
 if(!kind)return{status:'cancel',reason:'invalid'};
 if(!state||!me||!state.started||state.paused||state.street==='showdown'||state.street==='finished'||me.folded||me.eliminated||me.sittingOut||Number(me.chips||0)<=0)return{status:'cancel',reason:'inactive'};
 if(!me.turn)return{status:'waiting'};
 const toCall=Math.max(0,Number(state.toCall||0));
 if(kind==='checkfold')return{status:'action',action:toCall===0?'check':'fold'};
 if(kind==='check')return toCall===0?{status:'action',action:'check'}:{status:'cancel',reason:'check-no-longer-free'};
 if(kind==='callany')return{status:'action',action:toCall===0?'check':'call'};
 return{status:'cancel',reason:'invalid'};
}

let latest=null;
const listeners=new Set();
export function publishTableState(state){if(!state)return;latest=state;for(const fn of listeners){try{fn(state)}catch{}}}
export function subscribeTableState(fn){listeners.add(fn);if(latest)fn(latest);return()=>listeners.delete(fn)}
export function clearTableState(){latest=null}

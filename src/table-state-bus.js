let latest=null;
const listeners=new Set();
let installed=false;
export function publishTableState(state){if(!state)return;latest=state;for(const fn of listeners){try{fn(state)}catch{}}}
export function subscribeTableState(fn){listeners.add(fn);if(latest)fn(latest);return()=>listeners.delete(fn)}
export function installTableStateBus(){if(installed||typeof window==='undefined')return;installed=true;const Native=window.WebSocket;class ObservedWebSocket extends Native{constructor(...args){super(...args);this.addEventListener('message',e=>{if(typeof e.data!=='string'||e.data==='pong')return;try{const m=JSON.parse(e.data);if(m?.type==='state'&&m.state)publishTableState(m.state)}catch{}})}}Object.defineProperty(ObservedWebSocket,'CONNECTING',{value:Native.CONNECTING});Object.defineProperty(ObservedWebSocket,'OPEN',{value:Native.OPEN});Object.defineProperty(ObservedWebSocket,'CLOSING',{value:Native.CLOSING});Object.defineProperty(ObservedWebSocket,'CLOSED',{value:Native.CLOSED});window.WebSocket=ObservedWebSocket}

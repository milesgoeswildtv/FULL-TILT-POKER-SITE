import{subscribeTableState}from'./table-state-bus.js';
let latest=null,scheduled=false;
function patchLobby(){const rules=[...document.querySelectorAll('.rules b')];for(const el of rules)if(/^v\d+/i.test(el.textContent||''))el.textContent='CURRENT RULES'}
function patchTable(){if(!latest)return;const top=[...document.querySelectorAll('.topbar span')].find(el=>(el.textContent||'').includes('Blinds '));if(!top)return;const levels=Array.isArray(latest.blindStructure)&&latest.blindStructure.length?latest.blindStructure:null;if(!levels)return;const level=Math.max(0,Number(latest.blindLevel)||0),next=levels[Math.min(levels.length-1,level+1)];if(!next)return;const text=top.textContent||'';top.textContent=text.replace(/next\s+\d+[\/,]\d+\s+in/i,`next ${next[0]}/${next[1]} in`)}
function apply(){scheduled=false;patchLobby();patchTable()}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}
export function installUiTruthRuntime(){subscribeTableState(state=>{latest=state;schedule()});const observer=new MutationObserver(schedule);const start=()=>{observer.observe(document.body,{childList:true,subtree:true,characterData:true});schedule()};if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start()}

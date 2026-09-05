import './table-enhancements.css';

const seen=new WeakSet();

function context(){
  const m=location.hash.match(/^#\/table\/([A-Z0-9]{6})/i);
  if(!m)return null;
  const code=m[1].toUpperCase();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const token=params.get('token')||localStorage.getItem(`ftp_session_${code}`)||'';
  return {code,token};
}

function nextAlive(players,from){
  for(let k=1;k<=players.length;k++){
    const i=(from+k)%players.length;
    if(!players[i]?.eliminated)return i;
  }
  return from;
}

function positionMap(state){
  const alive=state.players.filter(p=>!p.eliminated);
  if(alive.length<2)return new Map();
  const dealer=state.dealerIndex;
  const sb=alive.length===2?dealer:nextAlive(state.players,dealer);
  const bb=nextAlive(state.players,sb);
  const map=new Map();
  map.set(dealer,['D']);
  map.set(sb,[...(map.get(sb)||[]),'SB']);
  map.set(bb,[...(map.get(bb)||[]),'BB']);
  return map;
}

function decorateSeats(state){
  const seats=[...document.querySelectorAll('.felt .seat')];
  if(!seats.length)return;
  const positions=positionMap(state);
  seats.forEach((seat,i)=>{
    let badge=seat.querySelector('.positionBadge');
    const labels=positions.get(i)||[];
    if(!labels.length){badge?.remove();return;}
    if(!badge){badge=document.createElement('span');badge.className='positionBadge';seat.appendChild(badge)}
    badge.textContent=labels.join(' • ');
  });
}

function formatClock(ms){
  const total=Math.max(0,Math.ceil(ms/1000));
  const min=Math.floor(total/60),sec=total%60;
  return `${min}:${String(sec).padStart(2,'0')}`;
}

function decorateTopbar(state){
  const info=document.querySelector('.topbar > div');
  if(!info)return;
  let meta=info.querySelector('.tableMeta');
  if(!meta){meta=document.createElement('div');meta.className='tableMeta';info.appendChild(meta)}
  let clock='—';
  if(state.started&&state.levelStartedAt){
    clock=state.paused?'PAUSED':formatClock(state.levelStartedAt+state.blindMinutes*60000-Date.now());
  }
  const alive=state.players.filter(p=>!p.eliminated).length;
  meta.textContent=`${alive} player${alive===1?'':'s'} left • Next blinds in ${clock}`;
}

function cardHtml(c){
  const red=c?.endsWith('♥')||c?.endsWith('♦');
  return `<span class="miniCard ${red?'red':''}">${c||'?'}</span>`;
}

function decorateLastHand(state){
  const result=state.lastResult;
  const hud=document.querySelector('.hud');
  if(!hud)return;
  let panel=document.querySelector('.lastHandPanel');
  if(!result?.summary){panel?.remove();return;}
  if(!panel){
    panel=document.createElement('details');
    panel.className='lastHandPanel';
    hud.insertAdjacentElement('afterend',panel);
  }
  const reveal=(result.revealed||[]).map(p=>`<div class="revealRow"><b>${escapeHtml(p.name)}</b><span>${(p.cards||[]).map(cardHtml).join('')}</span></div>`).join('');
  const board=(result.board||[]).map(cardHtml).join('');
  panel.innerHTML=`<summary>Last hand <span>${escapeHtml(result.summary)}</span></summary><div class="lastHandBody">${board?`<div class="lastBoard"><small>BOARD</small><div>${board}</div></div>`:''}${reveal||'<div class="muted">Won without showdown.</div>'}</div>`;
}

function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

function wireCopyFeedback(){
  document.querySelectorAll('.topbar button').forEach(btn=>{
    if(seen.has(btn)||!btn.textContent.includes('Copy Invite'))return;
    seen.add(btn);
    btn.addEventListener('click',()=>{
      const old=btn.textContent;
      btn.textContent='Copied ✓';
      setTimeout(()=>{if(document.body.contains(btn))btn.textContent=old},1400);
    });
  });
}

async function refresh(){
  const ctx=context();
  if(!ctx)return;
  try{
    const r=await fetch(`/api/tables/${ctx.code}?token=${encodeURIComponent(ctx.token)}`,{cache:'no-store'});
    if(!r.ok)return;
    const state=await r.json();
    decorateSeats(state);
    decorateTopbar(state);
    decorateLastHand(state);
    wireCopyFeedback();
  }catch{}
}

setInterval(refresh,1000);
addEventListener('hashchange',()=>setTimeout(refresh,100));
setTimeout(refresh,250);

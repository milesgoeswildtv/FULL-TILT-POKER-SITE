import React,{useEffect,useRef,useState}from'react';
import{THROWABLE_CATALOG,throwableById}from'../shared/throwables.js';
import'./throwables.css';

function ThrowableArt({item,className=''}){return item?.asset?<img className={className} src={item.asset} alt=""/>:<span className={className} aria-hidden="true">{item?.glyph||'?'}</span>}

export function ThrowablePicker({target,onThrow,onClose}){
 const[sending,setSending]=useState('');
 useEffect(()=>{if(!target)return;const close=e=>{if(e.key==='Escape')onClose?.()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[target,onClose]);
 if(!target)return null;
 async function choose(id){if(sending)return;setSending(id);try{await onThrow?.(id)}finally{setSending('')}}
 return <section className="throwablePicker" role="dialog" aria-modal="true" aria-label={`Throw at ${target.name}`}>
  <header><div><small>THROW AT</small><strong>{target.name}</strong></div><button type="button" className="throwableClose" onClick={onClose} aria-label="Close throwable picker">×</button></header>
  <div className="throwableGrid">{THROWABLE_CATALOG.map(item=><button type="button" key={item.id} disabled={!!sending} className={sending===item.id?'sending':''} onClick={()=>choose(item.id)} aria-label={`Throw ${item.label} at ${target.name}`}><ThrowableArt item={item} className="throwablePickerArt"/><span>{item.label}</span></button>)}</div>
 </section>
}

function matchingPlayerNode(playerId){
 return Array.from(document.querySelectorAll('[data-throw-player]')).find(node=>node.dataset.throwPlayer===String(playerId))||null;
}
function putArt(node,item){if(item.asset){const img=document.createElement('img');img.src=item.asset;img.alt='';node.appendChild(img)}else node.textContent=item.glyph}
function trimSeen(seen,max=120){while(seen.size>max)seen.delete(seen.values().next().value)}

export function ThrowableEffects({events=[]}){
 const layerRef=useRef(null),seenRef=useRef(new Set());
 useEffect(()=>{
  const layer=layerRef.current;if(!layer||!events.length)return;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const timers=[];
  const impact=(item,x,y)=>{
   const hit=document.createElement('span');hit.className=`throwableImpact effect-${item.effect}`;hit.style.left=`${x}px`;hit.style.top=`${y}px`;putArt(hit,item);layer.appendChild(hit);
   if(typeof hit.animate==='function'&&!reduce)hit.animate([{transform:'translate(-50%,-50%) scale(.55)',opacity:.2},{transform:'translate(-50%,-50%) scale(1.45)',opacity:1,offset:.34},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.68},{transform:'translate(-50%,-50%) scale(.92)',opacity:0}],{duration:item.effect==='splat'?820:650,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{}).finally(()=>hit.remove());
   else timers.push(setTimeout(()=>hit.remove(),reduce?300:650));
  };
  for(const event of events){
   if(!event?.id||seenRef.current.has(event.id))continue;
   seenRef.current.add(event.id);trimSeen(seenRef.current);
   const item=throwableById(event.throwableId),source=matchingPlayerNode(event.senderId),target=matchingPlayerNode(event.targetId);
   if(!item||!source||!target)continue;
   const bounds=layer.getBoundingClientRect(),a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),sx=a.left+a.width/2-bounds.left,sy=a.top+a.height/2-bounds.top,tx=b.left+b.width/2-bounds.left,ty=b.top+b.height/2-bounds.top;
   if(reduce){impact(item,tx,ty);continue}
   const shot=document.createElement('span');shot.className=`throwableProjectile effect-${item.effect}`;shot.style.left=`${sx}px`;shot.style.top=`${sy}px`;putArt(shot,item);layer.appendChild(shot);
   const dx=tx-sx,dy=ty-sy,arc=Math.min(120,Math.max(48,Math.abs(dx)*.18+Math.abs(dy)*.14));
   if(typeof shot.animate!=='function'){shot.remove();impact(item,tx,ty);continue}
   shot.animate([
    {transform:'translate(-50%,-50%) translate(0,0) rotate(-14deg) scale(.78)',opacity:.92},
    {transform:`translate(-50%,-50%) translate(${dx*.5}px,${dy*.5-arc}px) rotate(185deg) scale(1.08)`,opacity:1,offset:.52},
    {transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(370deg) scale(.9)`,opacity:1}
   ],{duration:560,easing:'cubic-bezier(.22,.68,.28,1)'}).finished.then(()=>impact(item,tx,ty)).catch(()=>{}).finally(()=>shot.remove());
  }
  return()=>timers.forEach(clearTimeout);
 },[events]);
 return <div className="throwableFxLayer" ref={layerRef} aria-hidden="true"/>;
}

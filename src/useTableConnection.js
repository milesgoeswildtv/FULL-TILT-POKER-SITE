import{useCallback,useEffect,useState}from'react';
import{publishTableState,clearTableState}from'./table-state-bus.js';

export function useTableConnection(code,token){
 const[state,setState]=useState(null),[error,setError]=useState(''),[realtime,setRealtime]=useState('connecting');
 const acceptState=useCallback(next=>{setState(next);publishTableState(next)},[]);
 const load=useCallback(async()=>{const r=await fetch(`/api/tables/${code}?token=${encodeURIComponent(token)}`),j=await r.json();if(r.ok){acceptState(j);setError('');return j}setError(j.error||'Table not found.');return null},[code,token,acceptState]);
 const action=useCallback(async(type,amount=0,targetId)=>{const r=await fetch(`/api/tables/${code}/action`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,type,amount:Number(amount)||0,targetId})}),j=await r.json();if(!r.ok){setError(j.error||'Action failed.');return false}acceptState(j);setError('');return true},[code,token,acceptState]);
 useEffect(()=>{let ws,retry,fallback,dead=false;load();const connect=()=>{if(dead)return;setRealtime('connecting');const proto=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(`${proto}//${location.host}/api/tables/${code}/ws?token=${encodeURIComponent(token)}`);ws.onopen=()=>setRealtime('live');ws.onmessage=e=>{if(e.data==='pong')return;try{const m=JSON.parse(e.data);if(m.type==='state'&&m.state){acceptState(m.state);setError('');setRealtime('live')}}catch{}};ws.onerror=()=>{try{ws.close()}catch{}};ws.onclose=()=>{if(dead)return;setRealtime('reconnecting');clearTimeout(retry);retry=setTimeout(connect,1500)}};connect();fallback=setInterval(()=>{if(!ws||ws.readyState!==WebSocket.OPEN)load()},15000);return()=>{dead=true;clearTimeout(retry);clearInterval(fallback);clearTableState();try{ws?.close(1000,'leaving table')}catch{}}},[code,token,load,acceptState]);
 return{state,error,setError,realtime,action};
}

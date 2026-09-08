import{useCallback,useEffect,useState}from'react';
import{publishTableState,clearTableState}from'./table-state-bus.js';

export function useTableConnection(code,token){
 const[state,setState]=useState(null),[error,setError]=useState(''),[realtime,setRealtime]=useState('connecting');
 const acceptState=useCallback(next=>{setState(next);publishTableState(next)},[]);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/tables/${code}?token=${encodeURIComponent(token)}`,{cache:'no-store'}),j=await r.json();if(r.ok){acceptState(j);setError('');return j}setError(j.error||'Table not found.')}catch{setError('Connection interrupted. Reconnecting…')}return null},[code,token,acceptState]);
 const action=useCallback(async(type,amount=0,targetId,extra={})=>{try{const r=await fetch(`/api/tables/${code}/action`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,type,amount:Number(amount)||0,targetId,...extra})}),j=await r.json();if(!r.ok){setError(j.error||'Action failed.');return false}acceptState(j);setError('');return true}catch{setError('Action could not reach the table. Try again.');return false}},[code,token,acceptState]);
 useEffect(()=>{let ws,retry,fallback,heartbeat,dead=false,attempt=0,lastPong=Date.now();
  const stopSocket=()=>{clearInterval(heartbeat);heartbeat=null;try{ws?.close()}catch{}ws=null};
  const scheduleReconnect=()=>{if(dead)return;setRealtime('reconnecting');clearTimeout(retry);const delay=Math.min(12000,1500*Math.pow(1.7,Math.min(attempt++,5)));retry=setTimeout(connect,delay)};
  const connect=()=>{if(dead||!navigator.onLine)return scheduleReconnect();clearTimeout(retry);stopSocket();setRealtime(attempt?'reconnecting':'connecting');const proto=location.protocol==='https:'?'wss:':'ws:';const socket=new WebSocket(`${proto}//${location.host}/api/tables/${code}/ws?token=${encodeURIComponent(token)}`);ws=socket;socket.onopen=()=>{if(socket!==ws||dead)return;attempt=0;lastPong=Date.now();setRealtime('live');load();heartbeat=setInterval(()=>{if(socket!==ws||socket.readyState!==WebSocket.OPEN)return;if(Date.now()-lastPong>45000){try{socket.close(4000,'heartbeat timeout')}catch{}return}try{socket.send('ping')}catch{}},20000)};socket.onmessage=e=>{if(socket!==ws)return;if(e.data==='pong'){lastPong=Date.now();return}try{const m=JSON.parse(e.data);if(m.type==='state'&&m.state){lastPong=Date.now();acceptState(m.state);setError('');setRealtime('live')}}catch{}};socket.onerror=()=>{try{socket.close()}catch{}};socket.onclose=()=>{if(socket!==ws||dead)return;clearInterval(heartbeat);heartbeat=null;ws=null;scheduleReconnect()}};
  const wake=()=>{if(dead)return;if(document.visibilityState==='visible'||navigator.onLine){load();if(!ws||ws.readyState>WebSocket.OPEN){attempt=0;connect()}}};
  load();connect();fallback=setInterval(()=>{if(!ws||ws.readyState!==WebSocket.OPEN)load()},12000);addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  return()=>{dead=true;clearTimeout(retry);clearInterval(fallback);clearInterval(heartbeat);removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);clearTableState();try{ws?.close(1000,'leaving table')}catch{}}},[code,token,load,acceptState]);
 return{state,error,setError,realtime,action};
}

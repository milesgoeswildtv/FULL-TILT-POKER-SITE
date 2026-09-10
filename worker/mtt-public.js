import{secureInt}from'./fairness.js';
import{normalizeTableConfig}from'./table-config.js';
import{normalizeBlindStructure}from'./tournament.js';

const CODE_RETRIES=8;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function code(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[secureInt(a.length)];return s}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function coordinator(env,tournamentCode){if(!env?.TOURNAMENTS)throw Error('Tournament binding unavailable.');return env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(tournamentCode))}
async function read(response){const body=await response.json().catch(()=>({}));return{response,body}}
function forward(stub,path,req,body){return stub.fetch(new Request(`https://tournament${path}`,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:body,duplex:body?'half':undefined}))}
async function sessionFor(stub,token){const{response,body}=await read(await stub.fetch(new Request(`https://tournament/session?token=${encodeURIComponent(token||'')}`)));if(!response.ok)throw Object.assign(Error(body.error||'Invalid tournament session.'),{status:response.status});return body}
async function requestBody(req){if(req.method==='GET'||req.method==='HEAD')return{raw:undefined,json:{}};const raw=await req.clone().text();let parsed={};if(raw)try{parsed=JSON.parse(raw)}catch{throw Object.assign(Error('Invalid JSON body.'),{status:400})}return{raw,json:parsed}}

export async function handleTournamentApi(req,env){
 const u=new URL(req.url);
 if(u.pathname==='/api/tournaments'&&req.method==='POST'){
  let input;try{input=await req.json()}catch{return json({error:'Invalid tournament configuration.'},400)}
  const hostName=cleanName(input.hostName||input.name);if(!hostName)return json({error:'Display name required.'},400);
  let config,blindStructure;try{config=normalizeTableConfig(input);blindStructure=normalizeBlindStructure(input.blindStructure)}catch(e){return json({error:e.message},400)}
  for(let attempt=0;attempt<CODE_RETRIES;attempt++){
   const tournamentCode=code(),stub=coordinator(env,tournamentCode),result=await stub.fetch(new Request('https://tournament/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:tournamentCode,players:[{name:hostName}],startingChips:config.startingChips,blindStructure,levelDurationMs:config.blindMinutes*60000})}));
   if(result.status!==409)return result;
  }
  return json({error:'Could not allocate a unique tournament code. Try again.'},503);
 }
 const match=u.pathname.match(/^\/api\/tournaments\/([A-Z0-9]{6})(?:\/(join|session|start|pause|resume|table)(?:\/(action|ws|chat))?)?$/);if(!match)return null;
 const tournamentCode=match[1],route=match[2]||'state',tableRoute=match[3]||'',stub=coordinator(env,tournamentCode);
 if(route==='state'&&req.method==='GET')return stub.fetch(new Request('https://tournament/state'));
 if(route==='join'&&req.method==='POST'){const{raw}=await requestBody(req);return forward(stub,'/join',req,raw)}
 if(route==='session'&&req.method==='GET')return stub.fetch(new Request(`https://tournament/session${u.search}`));
 if(['start','pause','resume'].includes(route)&&req.method==='POST'){
  let parsed;try{parsed=await requestBody(req)}catch(e){return json({error:e.message},e.status||400)}const token=String(parsed.json.token||'');
  let session;try{session=await sessionFor(stub,token)}catch(e){return json({error:e.message},e.status||403)}if(!session.session?.host)return json({error:'Tournament host only.'},403);
  return stub.fetch(new Request(`https://tournament/${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({now:Date.now()})}));
 }
 if(route==='table'){
  let parsed;try{parsed=await requestBody(req)}catch(e){return json({error:e.message},e.status||400)}const token=String(u.searchParams.get('token')||parsed.json.token||'');
  let session;try{session=await sessionFor(stub,token)}catch(e){return json({error:e.message},e.status||403)}const s=session.session,t=session.tournament;
  if(t?.status==='lobby'||!s?.provisioned)return json({error:'Tournament is still in the lobby.',tournament:t,session:s},409);if(!s?.tableKey)return json({error:'No active tournament table is assigned to this player.'},409);
  const tableStub=env.TABLES.get(env.TABLES.idFromName(s.tableKey)),path=tableRoute==='ws'?'websocket':tableRoute||'state',target=`https://table/${path}${req.method==='GET'?u.search:''}`;
  return tableStub.fetch(new Request(target,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:parsed.raw,duplex:parsed.raw?'half':undefined}));
 }
 return json({error:'Not found.'},404);
}

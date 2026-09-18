import{authenticatedIdentity}from'./auth.js';
import{accountRequest,resolveAccountId}from'./account-links.js';
import{isTerminalGameStatus}from'./game-registry.js';

const HOST_TICKET_COOKIE='ftp_host_key_ticket',TICKET_SECONDS=10*60,enc=new TextEncoder();

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}})}
function parseCookies(req){const out={};for(const part of String(req.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function secureCookie(name,value,maxAge){return name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge}
function clearCookie(name){return name+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}
async function digest(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(value||''))));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function registry(env){if(!env?.ACCESS_REGISTRY)throw Object.assign(Error('Private access registry unavailable.'),{status:503});return env.ACCESS_REGISTRY.get(env.ACCESS_REGISTRY.idFromName('crashout-access'))}
async function callRegistry(env,path,{method='POST',body}={}){const response=await registry(env).fetch(new Request('https://access.internal'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})),data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Private access request failed.'),{status:response.status,data});return data}
function gameRegistry(env){if(!env?.GAME_REGISTRY)throw Object.assign(Error('Game registry unavailable.'),{status:503});return env.GAME_REGISTRY.get(env.GAME_REGISTRY.idFromName('crashout-games'))}
async function callGameRegistry(env,path,{method='POST',body}={}){const response=await gameRegistry(env).fetch(new Request('https://games.internal'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})),data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Game registry request failed.'),{status:response.status,data});return data}
function gameObject(env,kind,code){if(kind==='table'){if(!env?.TABLES)throw Object.assign(Error('Poker table binding unavailable.'),{status:503});return env.TABLES.get(env.TABLES.idFromName(code))}if(kind==='tournament'){if(!env?.TOURNAMENTS)throw Object.assign(Error('Tournament binding unavailable.'),{status:503});return env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(code))}throw Object.assign(Error('Valid game kind required.'),{status:400})}
async function adminGameSummary(env,kind,code){const response=await gameObject(env,kind,code).fetch(new Request('https://game.internal/admin-summary')),data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Game could not be inspected.'),{status:response.status,data});return data}
async function snapshotGame(env,kind,code){const summary=await adminGameSummary(env,kind,code);await callGameRegistry(env,'/snapshot',{body:{kind,code,summary}});return summary}
async function recordGame(env,{kind,code,hostAccountId,hostName,status='lobby'}={}){if(!env?.GAME_REGISTRY||!cleanKind(kind)||cleanCode(code).length!==6)return null;try{return await callGameRegistry(env,'/record',{body:{kind,code:cleanCode(code),hostAccountId:String(hostAccountId||''),hostName:String(hostName||''),status,createdAt:Date.now()}})}catch(error){console.error('game_registry_record_failed',{kind,code,error:error.message});return null}}
async function logAdminGameEvent(env,{kind,code,action,result,note}={}){try{return await callGameRegistry(env,'/event',{body:{kind,code,action,result,note,at:Date.now()}})}catch(error){console.error('game_registry_event_failed',{kind,code,action,error:error.message});return null}}
async function refreshedGames(env){const listed=await callGameRegistry(env,'/list',{method:'GET'}),games=Array.isArray(listed.games)?listed.games:[],active=games.filter(g=>!isTerminalGameStatus(g.status));await Promise.allSettled(active.map(g=>snapshotGame(env,g.kind,g.code)));return (await callGameRegistry(env,'/list',{method:'GET'})).games||[]}
function cleanCode(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
function cleanKind(value){return value==='tournament'?'tournament':value==='table'?'table':null}
async function gameExists(env,kind,code){
 try{
  if(kind==='table'){if(!env?.TABLES)return false;const stub=env.TABLES.get(env.TABLES.idFromName(code)),r=await stub.fetch(new Request('https://table/access-exists'));return r.ok}
  if(kind==='tournament'){if(!env?.TOURNAMENTS)return false;const stub=env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(code)),r=await stub.fetch(new Request('https://tournament/access-exists'));return r.ok}
 }catch{}
 return false
}
async function resolveInvite(env,rawCode,requestedKind=null){
 const code=cleanCode(rawCode),kind=cleanKind(requestedKind);if(code.length!==6)throw Object.assign(Error('Enter a valid six-character invite code.'),{status:400});
 if(kind){if(!await gameExists(env,kind,code))throw Object.assign(Error('That private game could not be found.'),{status:404});return{kind,code}}
 const[table,tournament]=await Promise.all([gameExists(env,'table',code),gameExists(env,'tournament',code)]);
 if(table&&tournament)throw Object.assign(Error('That code matches more than one private game. Open the original invite link.'),{status:409});
 if(table)return{kind:'table',code};if(tournament)return{kind:'tournament',code};
 throw Object.assign(Error('That private game could not be found.'),{status:404})
}
async function directAccountRequest(env,accountId,path,body={}){
 if(!env?.ACCOUNTS)throw Object.assign(Error('Account storage unavailable.'),{status:503});const canonicalId=await resolveAccountId(env,accountId),stub=env.ACCOUNTS.get(env.ACCOUNTS.idFromName(canonicalId)),r=await stub.fetch(new Request('https://account.internal'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,canonicalId})})),data=await r.json().catch(()=>({}));if(!r.ok||data.error)throw Object.assign(Error(data.error||'Account access request failed.'),{status:r.status||400});return{...data,canonicalId}
}
async function grantInvite(env,identity,kind,code,source='invite'){
 const result=await accountRequest(env,identity,'/access/invite-grant',{kind,code,source});if(!result)throw Object.assign(Error('Account storage unavailable.'),{status:503});return result
}
async function redeemTicket(req,env,identity,ticket){
 if(!identity)throw Object.assign(Error('Crashout Poker login required.'),{status:401});const canonicalId=await resolveAccountId(env,identity.id),redeemed=await callRegistry(env,'/redeem',{body:{ticket,accountId:canonicalId}}),result=await accountRequest(env,identity,'/access/host-grant',{keyId:redeemed.keyId,type:redeemed.type});
 if(!result)throw Object.assign(Error('Account storage unavailable.'),{status:503});return{redeemed:true,type:redeemed.type,access:result.account?.access||null}
}
function adminAllowed(req,env){const expected=String(env?.ACCESS_ADMIN_SECRET||''),header=String(req.headers.get('authorization')||''),token=header.startsWith('Bearer ')?header.slice(7):String(req.headers.get('x-crashout-admin-key')||'');return!!expected&&token===expected}
async function requestFingerprint(req,prefix='access'){const raw=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||('ua:'+String(req.headers.get('user-agent')||'unknown'));return await digest(prefix+'|'+raw)}
async function throttledInvite(req,env,body){const fingerprint=await requestFingerprint(req,'invite');await callRegistry(env,'/attempt',{body:{fingerprint,invalid:false}});try{return await resolveInvite(env,body.code,body.kind)}catch(error){if(error.status===404)try{await callRegistry(env,'/attempt',{body:{fingerprint,invalid:true}})}catch(throttle){if(throttle.status===429)throw throttle}throw error}}

export async function handleAccessApi(req,env){
 const u=new URL(req.url);if(!u.pathname.startsWith('/api/access/'))return null;
 let body={};if(req.method==='POST')try{body=await req.json()}catch{}
 try{
  if(u.pathname==='/api/access/key/prepare'&&req.method==='POST'){
   const identity=await authenticatedIdentity(req,env),fingerprint=await requestFingerprint(req,'host-key'),prepared=await callRegistry(env,'/prepare',{body:{key:body.key,fingerprint}});
   if(identity){const result=await redeemTicket(req,env,identity,prepared.ticket);return json(result)}
   return json({ok:true,redeemed:false,type:prepared.type,requiresLogin:true},200,{'set-cookie':secureCookie(HOST_TICKET_COOKIE,prepared.ticket,TICKET_SECONDS)})
  }
  if(u.pathname==='/api/access/key/redeem'&&req.method==='POST'){
   const identity=await authenticatedIdentity(req,env);if(!identity)return json({error:'Crashout Poker login required.'},401);
   const ticket=parseCookies(req)[HOST_TICKET_COOKIE];if(!ticket)return json({ok:true,redeemed:false});
   const result=await redeemTicket(req,env,identity,ticket);return json(result,200,{'set-cookie':clearCookie(HOST_TICKET_COOKIE)})
  }
  if(u.pathname==='/api/access/invite/validate'&&req.method==='POST'){const invite=await throttledInvite(req,env,body);return json({ok:true,...invite})}
  if(u.pathname==='/api/access/invite/claim'&&req.method==='POST'){
   const identity=await authenticatedIdentity(req,env);if(!identity)return json({error:'Crashout Poker login required.'},401);const requestedKind=cleanKind(body.kind),requestedCode=cleanCode(body.code);if(requestedKind&&requestedCode.length===6){const existing=await accountRequest(env,identity,'/access/invite-check',{kind:requestedKind,code:requestedCode});if(existing?.allowed)return json({ok:true,kind:requestedKind,code:requestedCode,existing:true,access:existing.access||null})}const invite=await throttledInvite(req,env,body),granted=await grantInvite(env,identity,invite.kind,invite.code,String(body.source||'invite'));return json({ok:true,...invite,access:granted.account?.access||null})
  }
  if(u.pathname==='/api/access/admin/games'&&req.method==='GET'){
   if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);if(!env?.GAME_REGISTRY)return json({error:'Game registry is not configured.'},503);return json({games:await refreshedGames(env)})
  }
  if(u.pathname==='/api/access/admin/games/lookup'&&req.method==='POST'){
   if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);const code=cleanCode(body.code),requested=cleanKind(body.kind);if(code.length!==6)return json({error:'Valid six-character game code required.'},400);const kinds=requested?[requested]:['table','tournament'],found=[];
   for(const kind of kinds)try{const summary=await adminGameSummary(env,kind,code);await recordGame(env,{kind,code,hostAccountId:summary.hostAccountId,hostName:summary.hostName,status:summary.status});await callGameRegistry(env,'/snapshot',{body:{kind,code,summary}});found.push(summary)}catch(error){if(error.status!==404)console.error('admin_game_lookup_failed',{kind,code,error:error.message})}
   if(!found.length)return json({error:'Game could not be found.'},404);if(found.length>1)return json({error:'That code matches both a table and tournament.',games:found},409);return json({game:found[0]})
  }
  const adminGameMatch=u.pathname.match(/^\/api\/access\/admin\/games\/(table|tournament)\/([A-Z0-9]{6})(?:\/(control))?$/i);
  if(adminGameMatch){
   if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);const kind=adminGameMatch[1].toLowerCase(),code=adminGameMatch[2].toUpperCase(),control=adminGameMatch[3];
   if(!control&&req.method==='GET'){const summary=await snapshotGame(env,kind,code);return json({game:summary})}
   if(control&&req.method==='POST'){const action=String(body.action||'').toLowerCase();if(!['pause','resume','end'].includes(action))return json({error:'Action must be pause, resume, or end.'},400);const stub=gameObject(env,kind,code),path=kind==='table'?'/admin-control':'/'+action,response=await stub.fetch(new Request('https://game.internal'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(kind==='table'?{action}:{now:Date.now()})})),result=await response.json().catch(()=>({}));await logAdminGameEvent(env,{kind,code,action,result:response.ok?'success':'failed',note:response.ok?'':String(result.error||'').slice(0,240)});if(!response.ok)return json({error:result.error||'Admin control failed.',details:result},response.status);const summary=await snapshotGame(env,kind,code);return json({ok:true,action,game:summary})}
   return json({error:'Method not allowed.'},405)
  }
  if(u.pathname==='/api/access/admin/keys'&&req.method==='POST'){
   if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);if(!env?.ACCESS_ADMIN_SECRET)return json({error:'ACCESS_ADMIN_SECRET is not configured.'},503);return json(await callRegistry(env,'/admin/generate',{body:{type:body.type,count:body.count}}),201)
  }
  if(u.pathname==='/api/access/admin/keys'&&req.method==='GET'){if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);return json(await callRegistry(env,'/admin/list',{method:'GET'}))}
  if(u.pathname==='/api/access/admin/revoke-key'&&req.method==='POST'){if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);return json(await callRegistry(env,'/admin/revoke',{body:{id:body.id}}))}
  if(u.pathname==='/api/access/admin/revoke-host'&&req.method==='POST'){if(!adminAllowed(req,env))return json({error:'Admin access required.'},403);const accountId=String(body.accountId||'');if(!accountId)return json({error:'Account id required.'},400);return json(await directAccountRequest(env,accountId,'/access/revoke-host',{}))}
  return json({error:'Not found.'},404)
 }catch(error){const headers={};if(u.pathname==='/api/access/key/redeem')headers['set-cookie']=clearCookie(HOST_TICKET_COOKIE);return json({error:error.message},error.status||400,headers)}
}

export async function finalizeHostedGame(env,gated,response){
 const reservationId=String(gated?.hostReservationId||''),identity=gated?.identity,kind=gated?.hostKind;
 if(!identity||!kind)return response;
 if(!response.ok){if(reservationId)try{await accountRequest(env,identity,'/access/host-release',{reservationId})}catch{}return response}
 let body={};try{body=await response.clone().json()}catch{}const code=cleanCode(body.code);
 try{if(reservationId)await accountRequest(env,identity,'/access/host-finalize',{reservationId});if(code){await grantInvite(env,identity,kind,code,'created');await recordGame(env,{kind,code,hostAccountId:gated.canonicalId||identity.id,hostName:identity.displayName||identity.username||'Host',status:'lobby'})}}catch(error){console.error('host_access_finalize_failed',{accountId:gated.canonicalId,kind,code,error:error.message})}
 return response
}

export async function rebindAccessKeys(env,{fromAccountId,toAccountId,keyIds=[]}={}){
 if(!env?.ACCESS_REGISTRY||!fromAccountId||!toAccountId||!keyIds.length)return{updated:0};
 try{return await callRegistry(env,'/rebind',{body:{fromAccountId,toAccountId,keyIds}})}catch{return{updated:0}}
}

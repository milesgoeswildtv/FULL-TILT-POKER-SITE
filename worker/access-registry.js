import{secureInt}from'./fairness.js';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',KEY_CHARS=20,TICKET_TTL_MS=10*60*1000,ATTEMPT_WINDOW_MS=5*60*1000,ATTEMPT_LIMIT=30;
const enc=new TextEncoder();

function json(data,status=200){return Response.json(data,{status,headers:{'cache-control':'no-store'}})}
function normalizeKey(value=''){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,64)}
async function sha256(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(value||''))));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function randomChars(n){let out='';for(let i=0;i<n;i++)out+=ALPHABET[secureInt(ALPHABET.length)];return out}
function displayKey(raw){const chars=raw.match(/.{1,5}/g)||[];return'CRASH-'+chars.join('-')}
function validType(value){return value==='permanent'?'permanent':value==='one-time'?'one-time':null}
function cleanRecord(record={}){return{id:String(record.id||''),type:validType(record.type)||'one-time',createdAt:Number(record.createdAt)||0,status:record.revokedAt?'revoked':record.boundAccountId?'bound':'unused',boundAt:record.boundAt||null,revokedAt:record.revokedAt||null}}
function ticketId(){return crypto.randomUUID().replace(/-/g,'')}

export class AccessRegistry{
 constructor(state,env){this.state=state;this.env=env;this.queue=Promise.resolve()}
 async serialized(fn){const previous=this.queue;let release;this.queue=new Promise(resolve=>{release=resolve});await previous;try{return await fn()}finally{release()}}
 async keyRecordByHash(hash){return await this.state.storage.get('key:'+hash)||null}
 async rateLimit(fingerprint,invalid=false){
  const fp=String(fingerprint||'anon').slice(0,128),now=Date.now(),key='attempt:'+fp,state=await this.state.storage.get(key)||{startedAt:now,count:0};
  if(now-Number(state.startedAt||0)>=ATTEMPT_WINDOW_MS){state.startedAt=now;state.count=0}
  if(Number(state.count||0)>=ATTEMPT_LIMIT)throw Object.assign(Error('Too many access attempts. Try again in a few minutes.'),{status:429});
  if(invalid){state.count=Number(state.count||0)+1;await this.state.storage.put(key,state)}
 }
 async prepare(body={}){
  const normalized=normalizeKey(body.key),fingerprint=String(body.fingerprint||'anon');await this.rateLimit(fingerprint,false);
  if(!normalized.startsWith('CRASH')||normalized.length!==5+KEY_CHARS){await this.rateLimit(fingerprint,true);throw Object.assign(Error('Invalid host key.'),{status:404})}
  const hash=await sha256(normalized),record=await this.keyRecordByHash(hash);
  if(!record||record.revokedAt){await this.rateLimit(fingerprint,true);throw Object.assign(Error('Invalid host key.'),{status:404})}
  const ticket=ticketId(),expiresAt=Date.now()+TICKET_TTL_MS;
  await this.state.storage.put('ticket:'+ticket,{hash,expiresAt});
  return{ticket,expiresAt,type:record.type};
 }
 async redeem(body={}){return this.serialized(async()=>{
  const ticket=String(body.ticket||''),accountId=String(body.accountId||'');if(!ticket||!accountId)throw Object.assign(Error('Complete key redemption required.'),{status:400});
  const pending=await this.state.storage.get('ticket:'+ticket);if(!pending||Number(pending.expiresAt||0)<Date.now()){if(pending)await this.state.storage.delete('ticket:'+ticket);throw Object.assign(Error('Host key session expired. Enter the key again.'),{status:410})}
  const record=await this.keyRecordByHash(pending.hash);if(!record||record.revokedAt)throw Object.assign(Error('This host key is no longer available.'),{status:403});
  if(record.boundAccountId&&String(record.boundAccountId)!==accountId)throw Object.assign(Error('This host key is linked to another Crashout Poker account.'),{status:409});
  const alreadyBound=!!record.boundAccountId;if(!alreadyBound){record.boundAccountId=accountId;record.boundAt=Date.now();await this.state.storage.put('key:'+pending.hash,record)}
  await this.state.storage.delete('ticket:'+ticket);
  return{keyId:record.id,type:record.type,alreadyBound,boundAccountId:String(record.boundAccountId||accountId)};
 })}
 async generate(body={}){
  const type=validType(String(body.type||''));if(!type)throw Object.assign(Error('Key type must be one-time or permanent.'),{status:400});
  const count=Math.max(1,Math.min(100,Math.trunc(Number(body.count)||1))),created=[];
  let index=await this.state.storage.get('keyIndex')||[];
  for(let i=0;i<count;i++){
   let raw='',hash='';for(let tries=0;tries<8;tries++){raw=randomChars(KEY_CHARS);hash=await sha256('CRASH'+raw);if(!await this.keyRecordByHash(hash))break;raw=''}
   if(!raw)throw Object.assign(Error('Could not allocate a unique host key.'),{status:503});
   const id=crypto.randomUUID(),record={id,type,createdAt:Date.now(),boundAccountId:null,boundAt:null,revokedAt:null};
   await this.state.storage.put('key:'+hash,record);await this.state.storage.put('id:'+id,hash);index.push(id);created.push({id,type,key:displayKey(raw),createdAt:record.createdAt});
  }
  if(index.length>10000)index=index.slice(-10000);await this.state.storage.put('keyIndex',index);return created;
 }
 async list(){
  const index=await this.state.storage.get('keyIndex')||[],out=[];
  for(const id of [...index].reverse().slice(0,500)){const hash=await this.state.storage.get('id:'+id);if(!hash)continue;const record=await this.keyRecordByHash(hash);if(record)out.push(cleanRecord(record))}
  return out;
 }
 async revoke(body={}){
  const id=String(body.id||''),hash=await this.state.storage.get('id:'+id);if(!hash)throw Object.assign(Error('Host key not found.'),{status:404});
  const record=await this.keyRecordByHash(hash);if(!record)throw Object.assign(Error('Host key not found.'),{status:404});
  if(record.boundAccountId)throw Object.assign(Error('That key is already linked to an account. Revoke the account host entitlement instead.'),{status:409});
  record.revokedAt=record.revokedAt||Date.now();await this.state.storage.put('key:'+hash,record);return cleanRecord(record);
 }
 async rebind(body={}){
  const ids=Array.isArray(body.keyIds)?body.keyIds.map(String):[],from=String(body.fromAccountId||''),to=String(body.toAccountId||'');if(!from||!to||!ids.length)return{updated:0};
  let updated=0;for(const id of ids){const hash=await this.state.storage.get('id:'+id);if(!hash)continue;const record=await this.keyRecordByHash(hash);if(record&&String(record.boundAccountId||'')===from){record.boundAccountId=to;record.reboundAt=Date.now();await this.state.storage.put('key:'+hash,record);updated++}}
  return{updated};
 }
 async fetch(req){
  const u=new URL(req.url);let body={};if(req.method==='POST')try{body=await req.json()}catch{}
  try{
   if(u.pathname==='/attempt'&&req.method==='POST'){await this.rateLimit(String(body.fingerprint||'anon'),body.invalid===true);return json({ok:true})}
   if(u.pathname==='/prepare'&&req.method==='POST')return json(await this.prepare(body));
   if(u.pathname==='/redeem'&&req.method==='POST')return json(await this.redeem(body));
   if(u.pathname==='/admin/generate'&&req.method==='POST')return json({keys:await this.generate(body)},201);
   if(u.pathname==='/admin/list'&&req.method==='GET')return json({keys:await this.list()});
   if(u.pathname==='/admin/revoke'&&req.method==='POST')return json({key:await this.revoke(body)});
   if(u.pathname==='/rebind'&&req.method==='POST')return json(await this.rebind(body));
   return json({error:'Not found.'},404)
  }catch(error){return json({error:error.message},error.status||400)}
 }
}

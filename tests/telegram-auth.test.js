import test from'node:test';
import assert from'node:assert/strict';
import{authenticatedIdentity,handleAuthApi}from'../worker/auth.js';
import{telegramIdentity,verifyTelegramInitData}from'../worker/telegram-auth.js';

const enc=new TextEncoder();
async function hmac(keyBytes,message){const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function signedInitData(fields,botToken){const pairs=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)),check=pairs.map(([k,v])=>`${k}=${v}`).join('\n'),secret=await hmac(enc.encode('WebAppData'),botToken),hash=hex(await hmac(secret,check)),params=new URLSearchParams();for(const[k,v]of Object.entries(fields))params.set(k,v);params.set('hash',hash);return params.toString()}

test('Telegram Mini App init data validates and exposes only verified user data',async()=>{
 const botToken='123456:launch-test-token',now=Date.now(),user={id:99887766,first_name:'Sam',last_name:'Tilt',username:'samtilt',photo_url:'https://example.test/sam.jpg'},initData=await signedInitData({auth_date:String(Math.floor(now/1000)),query_id:'AAExample',start_param:'table_FT7K2Q',user:JSON.stringify(user)},botToken),result=await verifyTelegramInitData(initData,botToken,{now});
 assert.equal(result?.user?.id,99887766);assert.equal(result?.startParam,'table_FT7K2Q');
 const identity=telegramIdentity(result.user);assert.equal(identity.id,'telegram:99887766');assert.equal(identity.provider,'telegram');assert.equal(identity.displayName,'Sam Tilt');assert.equal(identity.avatarUrl,'https://example.test/sam.jpg');
});

test('Telegram Mini App verifier rejects payload tampering',async()=>{
 const botToken='123456:launch-test-token',now=Date.now(),initData=await signedInitData({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:42,first_name:'Real'})},botToken),params=new URLSearchParams(initData);params.set('user',JSON.stringify({id:42,first_name:'Forged'}));
 assert.equal(await verifyTelegramInitData(params.toString(),botToken,{now}),null);
});

test('Telegram Mini App verifier rejects stale, future, duplicate, and bot identities',async()=>{
 const botToken='123456:launch-test-token',now=Date.now(),stale=await signedInitData({auth_date:String(Math.floor(now/1000)-901),user:JSON.stringify({id:42,first_name:'Stale'})},botToken),future=await signedInitData({auth_date:String(Math.floor(now/1000)+31),user:JSON.stringify({id:42,first_name:'Future'})},botToken),bot=await signedInitData({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:42,first_name:'Bot',is_bot:true})},botToken),valid=await signedInitData({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:42,first_name:'Valid'})},botToken);
 assert.equal(await verifyTelegramInitData(stale,botToken,{now}),null);assert.equal(await verifyTelegramInitData(future,botToken,{now}),null);assert.equal(await verifyTelegramInitData(bot,botToken,{now}),null);assert.equal(await verifyTelegramInitData(`${valid}&auth_date=1`,botToken,{now}),null);
});

test('Telegram auth route exchanges verified init data for the normal Full Tilt account session',async()=>{
 const botToken='123456:launch-test-token',authSecret='full-tilt-session-secret',now=Date.now(),initData=await signedInitData({auth_date:String(Math.floor(now/1000)),start_param:'tournament_ABC123',user:JSON.stringify({id:777,first_name:'Kayla',username:'kayla'})},botToken),env={TELEGRAM_BOT_TOKEN:botToken,AUTH_SECRET:authSecret},response=await handleAuthApi(new Request('https://fulltilt.test/api/auth/telegram',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData})}),env);
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.identity.provider,'telegram');assert.equal(body.identity.id,'telegram:777');assert.equal(body.startParam,'tournament_ABC123');const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/ftp_account=/);const cookie=setCookie.split(';')[0],identity=await authenticatedIdentity(new Request('https://fulltilt.test/api/auth/me',{headers:{cookie}}),env);assert.equal(identity?.id,'telegram:777');assert.equal(identity?.displayName,'Kayla');
});

import test from'node:test';
import assert from'node:assert/strict';
import{authenticatedIdentity,gatePokerRequest,handleAuthApi}from'../worker/auth.js';
import{telegramIdentity,verifyTelegramInitData}from'../worker/telegram-auth.js';

const enc=new TextEncoder();
async function hmac(keyBytes,message){const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function signedInitData(fields,botToken){const pairs=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)),check=pairs.map(([k,v])=>`${k}=${v}`).join('\n'),secret=await hmac(enc.encode('WebAppData'),botToken),hash=hex(await hmac(secret,check)),params=new URLSearchParams();for(const[k,v]of Object.entries(fields))params.set(k,v);params.set('hash',hash);return params.toString()}
async function telegramSession({id=777,first_name='Kayla',username='kayla',start_param=''}={}){const botToken='123456:launch-test-token',authSecret='full-tilt-session-secret',now=Date.now(),fields={auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name,username})};if(start_param)fields.start_param=start_param;const initData=await signedInitData(fields,botToken),env={TELEGRAM_BOT_TOKEN:botToken,AUTH_SECRET:authSecret},response=await handleAuthApi(new Request('https://fulltilt.test/api/auth/telegram',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData})}),env),cookie=(response.headers.get('set-cookie')||'').split(';')[0];return{env,response,cookie}}

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
 const{env,response,cookie}=await telegramSession({start_param:'tournament_ABC123'});assert.equal(response.status,200);const body=await response.json();assert.equal(body.identity.provider,'telegram');assert.equal(body.identity.id,'telegram:777');assert.equal(body.startParam,'tournament_ABC123');assert.match(cookie,/^ftp_account=/);const identity=await authenticatedIdentity(new Request('https://fulltilt.test/api/auth/me',{headers:{cookie}}),env);assert.equal(identity?.id,'telegram:777');assert.equal(identity?.displayName,'Kayla');
});

test('Telegram account sessions pass the same poker API gate and inject verified identity',async()=>{
 const{env,cookie}=await telegramSession({id:888,first_name:'Mikey',username:'mikey'}),request=new Request('https://fulltilt.test/api/tables',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({hostName:'forged-browser-name',startingChips:2500,blindMinutes:10})}),gated=await gatePokerRequest(request,env);assert.equal(gated.response,null);assert.equal(gated.identity?.id,'telegram:888');const body=await gated.request.json();assert.equal(body.hostName,'Mikey');assert.equal(body.accountId,'telegram:888');assert.equal(body.cosmetic,'default');
});

test('Telegram player can begin a Discord linking OAuth flow without replacing the Telegram session',async()=>{
 const{env,cookie}=await telegramSession({id:999,first_name:'Link',username:'linkme'});Object.assign(env,{DISCORD_CLIENT_ID:'discord-client',DISCORD_CLIENT_SECRET:'discord-secret'});const response=await handleAuthApi(new Request('https://fulltilt.test/api/auth/link/discord',{headers:{cookie}}),env);assert.equal(response.status,302);assert.match(response.headers.get('location')||'',/^https:\/\/discord\.com\/oauth2\/authorize\?/);const setCookie=response.headers.get('set-cookie')||'';assert.match(setCookie,/ftp_oauth_state=/);assert.match(setCookie,/ftp_oauth_link=discord/);const identity=await authenticatedIdentity(new Request('https://fulltilt.test/api/auth/me',{headers:{cookie}}),env);assert.equal(identity?.id,'telegram:999');
});

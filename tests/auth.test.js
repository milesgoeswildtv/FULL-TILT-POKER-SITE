import test from'node:test';
import assert from'node:assert/strict';
import{gatePokerRequest,handleAuthApi}from'../worker/auth.js';
import{PlayerAccount}from'../worker/player-account.js';

class MemoryStorage{constructor(){this.map=new Map()}async get(k){return this.map.get(k)}async put(k,v){this.map.set(k,v)}}

test('poker APIs require a Discord account session',async()=>{const gated=await gatePokerRequest(new Request('https://fulltilt.test/api/tables/ABC123',{method:'GET'}),{});assert.equal(gated.response.status,401);assert.match((await gated.response.json()).error,/Discord login required/i)})

test('non poker APIs pass through account gate',async()=>{const req=new Request('https://fulltilt.test/assets/foo.png'),gated=await gatePokerRequest(req,{});assert.equal(gated.response,null);assert.equal(gated.request,req)})

test('Discord login reports missing server configuration cleanly',async()=>{const res=await handleAuthApi(new Request('https://fulltilt.test/api/auth/discord'),{});assert.equal(res.status,503);assert.match((await res.json()).error,/not configured/i)})

test('player accounts persist identity, stats and starter loadout',async()=>{const storage=new MemoryStorage(),account=new PlayerAccount({storage},{}),identity={id:'discord-1',username:'sam',displayName:'Sam',avatar:null};let res=await account.fetch(new Request('https://account.internal/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identity})})),body=await res.json();assert.equal(res.status,200);assert.equal(body.account.displayName,'Sam');assert.deepEqual(body.account.inventory,['default']);assert.equal(body.account.equipped,'default');assert.equal(body.account.stats.handsPlayed,0);
 res=await account.fetch(new Request('https://account.internal/equip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identity,cosmetic:'constellation'})}));assert.equal(res.status,403);body=await res.json();assert.match(body.error,/not in your inventory/i)})

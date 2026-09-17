import test from'node:test';
import assert from'node:assert/strict';
import{PlayerAccount}from'../worker/player-account.js';
import{accountRequest,linkTelegramToDiscord,resolveAccountId}from'../worker/account-links.js';

class MemoryStorage{constructor(){this.map=new Map()}async get(k){return this.map.get(k)}async put(k,v){this.map.set(k,v)}async delete(k){this.map.delete(k)}}
class AccountNamespace{constructor(){this.rows=new Map()}idFromName(name){return String(name)}get(id){id=String(id);if(!this.rows.has(id)){const storage=new MemoryStorage(),ctx={storage};const env={ACCOUNTS:this};this.rows.set(id,{storage,account:new PlayerAccount(ctx,env)})}const row=this.rows.get(id);return{fetch:(input,init)=>row.account.fetch(input instanceof Request?input:new Request(input,init))}}}
async function post(stub,path,body={}){const r=await stub.fetch(`https://account.internal${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return{response:r,body:await r.json()}}
const discord={id:'123456789',provider:'discord',providerId:'123456789',username:'samdiscord',displayName:'Sam Discord',avatar:null,avatarUrl:null};
const telegram={id:'telegram:99887766',provider:'telegram',providerId:'99887766',username:'samtelegram',displayName:'Sam Telegram',avatar:null,avatarUrl:null};

test('linking migrates Telegram history into the Discord canonical account exactly once',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};
 await accountRequest(env,discord,'/sync');await accountRequest(env,telegram,'/sync');
 await post(ns.get(discord.id),'/stats/checkpoint',{source:'table:WEB001',stats:{handsPlayed:3,knockouts:1,biggestPot:500,chipsWon:700}});
 await post(ns.get(telegram.id),'/stats/checkpoint',{source:'table:TG0001',stats:{handsPlayed:5,knockouts:2,biggestPot:900,chipsWon:1100}});
 await post(ns.get(discord.id),'/purchase/grant',{purchaseKey:'regalia',entitlements:['regalia'],checkoutSessionId:'cs_discord',paymentIntent:'pi_discord',amountTotal:499,currency:'usd'});
 await post(ns.get(telegram.id),'/purchase/grant',{purchaseKey:'constellation',entitlements:['constellation'],checkoutSessionId:'cs_telegram_legacy',paymentIntent:'pi_telegram',amountTotal:299,currency:'usd'});
 const first=await linkTelegramToDiscord(env,telegram,discord);assert.equal(first.canonicalId,discord.id);assert.equal(first.alreadyLinked,false);assert.equal(await resolveAccountId(env,telegram.id),discord.id);
 let profile=await accountRequest(env,telegram,'/profile');assert.equal(profile.canonicalId,discord.id);assert.equal(profile.account.stats.handsPlayed,8);assert.equal(profile.account.stats.knockouts,3);assert.equal(profile.account.stats.biggestPot,900);assert.equal(profile.account.stats.chipsWon,1800);assert.deepEqual(profile.account.inventory.sort(),['constellation','default','regalia']);assert.equal(profile.account.links.telegram.username,'samtelegram');assert.equal(profile.account.links.discord.username,'samdiscord');
 const second=await linkTelegramToDiscord(env,telegram,discord);assert.equal(second.alreadyLinked,true);profile=await accountRequest(env,discord,'/profile');assert.equal(profile.account.stats.handsPlayed,8);assert.equal(profile.account.purchases.length,2);
});

test('already-open Telegram tables forward later stat checkpoints through the alias',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns};await accountRequest(env,discord,'/sync');await accountRequest(env,telegram,'/sync');
 await post(ns.get(telegram.id),'/stats/checkpoint',{source:'table:OPEN01',stats:{handsPlayed:4,knockouts:0,biggestPot:200,chipsWon:250}});await linkTelegramToDiscord(env,telegram,discord);
 const forwarded=await post(ns.get(telegram.id),'/stats/checkpoint',{source:'table:OPEN01',stats:{handsPlayed:6,knockouts:1,biggestPot:450,chipsWon:600}});assert.equal(forwarded.response.status,200);assert.equal(forwarded.body.account.stats.handsPlayed,6);assert.equal(forwarded.body.account.stats.knockouts,1);assert.equal(forwarded.body.account.stats.biggestPot,450);assert.equal(forwarded.body.account.stats.chipsWon,600);
});

test('one Discord account cannot silently absorb two different Telegram identities',async()=>{
 const ns=new AccountNamespace(),env={ACCOUNTS:ns},other={id:'telegram:112233',provider:'telegram',providerId:'112233',username:'other',displayName:'Other'};await accountRequest(env,discord,'/sync');await accountRequest(env,telegram,'/sync');await accountRequest(env,other,'/sync');await linkTelegramToDiscord(env,telegram,discord);await assert.rejects(()=>linkTelegramToDiscord(env,other,discord),/already linked to another Telegram/i);assert.equal(await resolveAccountId(env,other.id),other.id);
});

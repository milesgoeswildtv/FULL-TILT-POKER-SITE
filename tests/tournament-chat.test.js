import test from'node:test';
import assert from'node:assert/strict';
import{TournamentChat}from'../worker/tournament-chat.js';

function chat(){let saved=[];const state={storage:{get:async()=>structuredClone(saved),put:async(_key,value)=>{saved=structuredClone(value)}}};return new TournamentChat(state)}
async function post(c,body){return c.fetch(new Request('https://chat/message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))}

test('global tournament chat stores sanitized authenticated player messages',async()=>{const c=chat(),r=await post(c,{senderId:'p01',name:'  Sam  ',tableNumber:3,message:'  hello global\u0000  '}),j=await r.json();assert.equal(r.status,200);assert.equal(j.messages.length,1);assert.equal(j.messages[0].name,'Sam');assert.equal(j.messages[0].message,'hello global');assert.equal(j.messages[0].tableNumber,3);const state=await(await c.fetch(new Request('https://chat/state'))).json();assert.equal(state.messages[0].senderId,'p01')});

test('global tournament chat rejects unauthenticated sender metadata',async()=>{const c=chat(),r=await post(c,{name:'Sam',message:'hi'}),j=await r.json();assert.equal(r.status,403);assert.match(j.error,/authenticated/i)});

test('global tournament chat rejects empty messages',async()=>{const c=chat(),r=await post(c,{senderId:'p01',name:'Sam',message:'   '}),j=await r.json();assert.equal(r.status,400);assert.match(j.error,/message required/i)});

import test from'node:test';
import assert from'node:assert/strict';
import{verifyStripeSignature}from'../worker/shop.js';

const enc=new TextEncoder();
async function sign(secret,payload){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(payload)));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}

test('Stripe webhook verification accepts a valid current signature',async()=>{const secret='whsec_test_secret',raw=JSON.stringify({id:'evt_test',type:'checkout.session.completed'}),timestamp=Math.floor(Date.now()/1000),signature=await sign(secret,`${timestamp}.${raw}`);assert.equal(await verifyStripeSignature(raw,`t=${timestamp},v1=${signature}`,secret),true)})

test('Stripe webhook verification rejects tampering and stale timestamps',async()=>{const secret='whsec_test_secret',raw=JSON.stringify({id:'evt_test'}),timestamp=Math.floor(Date.now()/1000),signature=await sign(secret,`${timestamp}.${raw}`);assert.equal(await verifyStripeSignature(`${raw}x`,`t=${timestamp},v1=${signature}`,secret),false);const stale=timestamp-1000,staleSignature=await sign(secret,`${stale}.${raw}`);assert.equal(await verifyStripeSignature(raw,`t=${stale},v1=${staleSignature}`,secret),false)})

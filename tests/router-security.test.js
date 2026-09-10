import test from'node:test';
import assert from'node:assert/strict';
import{hardenResponse}from'../worker/router.js';

test('normal worker responses receive baseline browser security headers',async()=>{const r=hardenResponse(new Response('ok',{status:200,headers:{'content-type':'text/plain','x-custom':'kept'}}));assert.equal(await r.text(),'ok');assert.equal(r.status,200);assert.equal(r.headers.get('x-custom'),'kept');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=(), payment=()')});

test('websocket upgrade responses are never reconstructed by response hardening',()=>{const upgrade={status:101,webSocket:{accepted:true},headers:new Headers()};assert.equal(hardenResponse(upgrade),upgrade)});

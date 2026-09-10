import test from'node:test';
import assert from'node:assert/strict';
import router,{hardenResponse}from'../worker/router.js';
import{APP_VERSION}from'../worker/health.js';

test('normal worker responses receive baseline browser security headers',async()=>{const r=hardenResponse(new Response('ok',{status:200,headers:{'content-type':'text/plain','x-custom':'kept'}}));assert.equal(await r.text(),'ok');assert.equal(r.status,200);assert.equal(r.headers.get('x-custom'),'kept');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=(), payment=()')});

test('websocket upgrade responses are never reconstructed by response hardening',()=>{const upgrade={status:101,webSocket:{accepted:true},headers:new Headers()};assert.equal(hardenResponse(upgrade),upgrade)});

test('deployed router health uses the authoritative release version and security headers',async()=>{const r=await router.fetch(new Request('https://fulltilt.test/api/health'),{},{}),j=await r.json();assert.equal(r.status,200);assert.equal(j.version,APP_VERSION);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY')});

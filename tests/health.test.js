import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{APP_VERSION,healthPayload,healthResponse}from'../worker/health.js';

test('health version matches package release version',async()=>{const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(APP_VERSION,pkg.version);assert.equal(healthPayload().version,pkg.version)});

test('health endpoint is explicitly non-cacheable',async()=>{const r=healthResponse(),j=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(j.ok,true);assert.equal(j.name,'FULL TILT POKER')});

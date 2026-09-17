import test from'node:test';
import assert from'node:assert/strict';
import{authenticatedIdentity}from'../worker/auth.js';

const enc=new TextEncoder();
function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function signedSession(identity,secret){const body=b64url(enc.encode(JSON.stringify(identity))),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body))));return`${body}.${signature}`}
function requestWithSession(token){return new Request('https://fulltilt.test/api/auth/me',{headers:{cookie:`ftp_account=${token}`}})}

test('account session accepts a valid HMAC and rejects a tampered signature',async()=>{
 const secret='launch-test-secret',token=await signedSession({id:'discord-verified',username:'sam',displayName:'Sam',exp:Date.now()+60000},secret),valid=await authenticatedIdentity(requestWithSession(token),{AUTH_SECRET:secret});
 assert.equal(valid?.id,'discord-verified');
 const last=token.at(-1),tampered=`${token.slice(0,-1)}${last==='A'?'B':'A'}`;
 assert.equal(await authenticatedIdentity(requestWithSession(tampered),{AUTH_SECRET:secret}),null);
});

test('malformed or expired signed sessions fail closed',async()=>{
 const secret='launch-test-secret';
 assert.equal(await authenticatedIdentity(requestWithSession('body.***'),{AUTH_SECRET:secret}),null);
 const expired=await signedSession({id:'discord-expired',exp:Date.now()-1},secret);
 assert.equal(await authenticatedIdentity(requestWithSession(expired),{AUTH_SECRET:secret}),null);
});

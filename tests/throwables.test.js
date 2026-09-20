import test from'node:test';
import assert from'node:assert/strict';
import{THROWABLE_CATALOG,THROWABLE_IDS,normalizeThrowableId,throwableById}from'../shared/throwables.js';

test('starter throwable catalog is unique and complete',()=>{
 assert.equal(THROWABLE_CATALOG.length,10);
 assert.equal(THROWABLE_IDS.size,THROWABLE_CATALOG.length);
 for(const item of THROWABLE_CATALOG){
  assert.ok(item.id);
  assert.ok(item.label);
  assert.ok(item.glyph||item.asset);
  assert.ok(['splat','crack','pop','burst','smack'].includes(item.effect));
 }
});

test('throwable ids normalize through the canonical catalog',()=>{
 assert.equal(normalizeThrowableId(' POOP '),'poop');
 assert.equal(normalizeThrowableId('not-real'),'');
 assert.equal(throwableById('shoe')?.label,'Shoe');
 assert.equal(throwableById('nope'),null);
});

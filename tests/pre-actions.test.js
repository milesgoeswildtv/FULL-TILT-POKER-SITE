import test from'node:test';
import assert from'node:assert/strict';
import{normalizePreAction,resolvePreAction}from'../src/pre-actions.js';

function state(overrides={}){return{started:true,paused:false,street:'flop',toCall:0,...overrides}}
function player(overrides={}){return{turn:false,folded:false,eliminated:false,sittingOut:false,chips:1200,...overrides}}

test('pre-actions normalize only supported intentions',()=>{
 assert.equal(normalizePreAction('CHECKFOLD'),'checkfold');
 assert.equal(normalizePreAction('check'),'check');
 assert.equal(normalizePreAction('callany'),'callany');
 assert.equal(normalizePreAction('raise'),null);
});

test('queued pre-action waits until the player actually has the turn',()=>{
 assert.deepEqual(resolvePreAction('checkfold',state({toCall:400}),player({turn:false})),{status:'waiting'});
});

test('check/fold checks for free and folds when facing a bet',()=>{
 assert.deepEqual(resolvePreAction('checkfold',state({toCall:0}),player({turn:true})),{status:'action',action:'check'});
 assert.deepEqual(resolvePreAction('checkfold',state({toCall:250}),player({turn:true})),{status:'action',action:'fold'});
});

test('check cancels itself if checking is no longer legal',()=>{
 assert.deepEqual(resolvePreAction('check',state({toCall:0}),player({turn:true})),{status:'action',action:'check'});
 assert.deepEqual(resolvePreAction('check',state({toCall:1}),player({turn:true})),{status:'cancel',reason:'check-no-longer-free'});
});

test('call any checks for free and otherwise calls the authoritative current amount',()=>{
 assert.deepEqual(resolvePreAction('callany',state({toCall:0}),player({turn:true})),{status:'action',action:'check'});
 assert.deepEqual(resolvePreAction('callany',state({toCall:99999}),player({turn:true,chips:300})),{status:'action',action:'call'});
});

test('pre-actions cancel when the seat or hand is no longer active',()=>{
 for(const [s,p] of[
  [state({paused:true}),player()],
  [state({street:'showdown'}),player()],
  [state({street:'finished'}),player()],
  [state(),player({folded:true})],
  [state(),player({eliminated:true})],
  [state(),player({sittingOut:true})],
  [state(),player({chips:0})]
 ])assert.equal(resolvePreAction('checkfold',s,p).status,'cancel');
});

import test from'node:test';
import assert from'node:assert/strict';
import{THROWABLE_COOLDOWN_MS,createThrowableEvent}from'../worker/throwables.js';

const sender={id:'A',name:'Sam'},target={id:'B',name:'Kass'},players=[sender,target];

test('creates a targeted live-game throwable event',()=>{
 const event=createThrowableEvent({sender,players,started:true,street:'flop',targetId:'B',throwableId:'poop',lastThrownAt:0,now:5000,eventId:'E1'});
 assert.deepEqual(event,{id:'E1',throwableId:'poop',senderId:'A',targetId:'B',at:5000});
});

test('rejects invalid targets, ids, self throws and spam',()=>{
 assert.throws(()=>createThrowableEvent({sender,players,started:true,street:'turn',targetId:'A',throwableId:'poop',now:5000,eventId:'E2'}),/another player/i);
 assert.throws(()=>createThrowableEvent({sender,players,started:true,street:'turn',targetId:'B',throwableId:'bogus',now:5000,eventId:'E3'}),/unknown throwable/i);
 assert.throws(()=>createThrowableEvent({sender,players,started:true,street:'turn',targetId:'B',throwableId:'poop',lastThrownAt:5000,now:5000+THROWABLE_COOLDOWN_MS-1,eventId:'E4'}),/slow down/i);
});

test('rejects throwables outside a live game',()=>{
 assert.throws(()=>createThrowableEvent({sender,players,started:false,street:'waiting',targetId:'B',throwableId:'poop',now:5000,eventId:'E5'}),/live game/i);
 assert.throws(()=>createThrowableEvent({sender,players,started:true,street:'finished',targetId:'B',throwableId:'poop',now:5000,eventId:'E6'}),/live game/i);
});

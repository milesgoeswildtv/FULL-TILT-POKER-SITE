import test from'node:test';
import assert from'node:assert/strict';
import{THROWABLE_COOLDOWN_MS,createThrowableEvent}from'../worker/throwables.js';

const sender={id:'A',name:'Sam'},target={id:'B',name:'Kass'},players=[sender,target];

test('creates a targeted live-game throwable event',()=>{
 const event=createThrowableEvent({sender,players,street:'flop',targetId:'B',throwableId:'poop',lastThrownAt:0,now:5000,eventId:'E1'});
 assert.deepEqual(event,{id:'E1',throwableId:'poop',senderId:'A',targetId:'B',at:5000});
});

test('rejects invalid targets, ids, self throws and spam',()=>{
 assert.throws(()=>createThrowableEvent({sender,players,street:'turn',targetId:'A',throwableId:'poop',now:5000,eventId:'E2'}),/another player/i);
 assert.throws(()=>createThrowableEvent({sender,players,street:'turn',targetId:'B',throwableId:'bogus',now:5000,eventId:'E3'}),/unknown throwable/i);
 assert.throws(()=>createThrowableEvent({sender,players,street:'turn',targetId:'B',throwableId:'poop',lastThrownAt:5000,now:5000+THROWABLE_COOLDOWN_MS-1,eventId:'E4'}),/slow down/i);
});

test('allows table throwables before play starts and rejects them after close',()=>{
 const event=createThrowableEvent({sender,players,street:'waiting',targetId:'B',throwableId:'poop',now:5000,eventId:'E5'});
 assert.equal(event.targetId,'B');
 assert.throws(()=>createThrowableEvent({sender,players,street:'finished',targetId:'B',throwableId:'poop',now:5000,eventId:'E6'}),/after the game closes/i);
});

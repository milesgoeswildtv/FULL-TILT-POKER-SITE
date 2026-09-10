import test from'node:test';
import assert from'node:assert/strict';
import{globalTournamentStats,tournamentScreen,tournamentWinner}from'../src/mtt-view.js';

test('live global standings rank active stacks ahead of eliminated finishers',()=>{const t={status:'running',players:[{id:'a',name:'A',chips:1200,eliminated:false,stats:{handsPlayed:10,vpipHands:5,pfrHands:2}},{id:'b',name:'B',chips:3400,eliminated:false,stats:{handsPlayed:10,vpipHands:2,pfrHands:1}},{id:'c',name:'C',chips:0,eliminated:true,finishPlace:12,stats:{handsPlayed:8}}]},rows=globalTournamentStats(t);assert.deepEqual(rows.map(x=>x.id),['b','a','c']);assert.equal(rows[0].stats.vpip,20);assert.equal(rows[1].stats.pfr,20)});

test('finished standings use canonical finish place and winner',()=>{const t={status:'finished',players:[{id:'a',name:'A',chips:0,eliminated:true,finishPlace:2,stats:{}},{id:'b',name:'B',chips:5000,eliminated:false,finishPlace:1,stats:{}}]},rows=globalTournamentStats(t);assert.deepEqual(rows.map(x=>x.finishPlace),[1,2]);assert.equal(tournamentWinner(t).id,'b')});

test('tournament result screen chooses eliminated finished and host-ended states',()=>{assert.equal(tournamentScreen({status:'running'},{eliminated:true}),'eliminated');assert.equal(tournamentScreen({status:'finished'},{eliminated:true}),'finished');assert.equal(tournamentScreen({status:'ended'},{eliminated:false}),'ended');assert.equal(tournamentScreen({status:'running'},{eliminated:false}),'play')});

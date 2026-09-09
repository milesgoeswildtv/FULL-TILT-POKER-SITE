import test from'node:test';import assert from'node:assert/strict';
import{applyTournamentBlinds,tournamentTableReport}from'../worker/mtt-table-link.js';

test('table snapshots global blinds only at the new-hand boundary',()=>{const d={smallBlind:50,bigBlind:100,minRaise:100,blindLevel:0};const snapshot={clock:{blindLevel:1,smallBlind:75,bigBlind:150,remainingMs:149000},handBlinds:{blindLevel:1,smallBlind:75,bigBlind:150,ante:0}};assert.equal(d.bigBlind,100);assert.equal(applyTournamentBlinds(d,snapshot),true);assert.equal(d.smallBlind,75);assert.equal(d.bigBlind,150);assert.equal(d.minRaise,150);assert.equal(d.blindLevel,1);});

test('table report preserves tournament identity and exact stacks',()=>{const report=tournamentTableReport({handNumber:12,street:'showdown',players:[{id:'local-a',tournamentPlayerId:'p01',chips:8125,eliminated:false},{id:'local-b',tournamentPlayerId:'p02',chips:0,eliminated:true,finishPlace:41}]});assert.equal(report.handNumber,12);assert.equal(report.players[0].id,'p01');assert.equal(report.players[0].chips,8125);assert.equal(report.players[1].id,'p02');assert.equal(report.players[1].chips,0);assert.equal(report.players[1].finishPlace,41);});

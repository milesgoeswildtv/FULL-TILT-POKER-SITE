import test from'node:test';
import assert from'node:assert/strict';
import{TournamentCoordinator}from'../worker/tournament-coordinator.js';
import{createTournamentClock}from'../worker/tournament-clock.js';

function player(id,name,token,host=false){return{id,token,name,chips:2500,eliminated:false,finishPlace:null,moveCount:0,tableNumber:null,seat:null,handStartChips:2500,stats:{},cosmetic:'default',host}}
function lobby(){const c=new TournamentCoordinator({storage:{}},{});c.data={code:'ABC123',status:'lobby',startingChips:2500,players:[player('p01','Host','host-token',true)],tables:[],pendingMoves:[],clock:createTournamentClock({blindStructure:[[10,20],[15,30]],levelDurationMs:600000,now:1000}),createdAt:1000,startedAt:null,finishedAt:null};c.rebuildLobbySeating();return c}

test('live MTT lobby reseats entrants across shared 8-max tables',()=>{const c=lobby();for(let i=2;i<=17;i++)c.joinLobby(`Player ${i}`);assert.equal(c.data.players.length,17);assert.equal(c.data.tables.length,3);assert.deepEqual(c.data.tables.map(t=>t.playerIds.length),[6,6,5]);assert.ok(c.data.tables.every(t=>t.playerIds.length<=8));assert.equal(new Set(c.data.players.map(p=>`${p.tableNumber}:${p.seat}`)).size,17)});

test('tournament session token survives lobby reseating and resolves current table',()=>{const c=lobby(),token=c.data.players[0].token;for(let i=2;i<=10;i++)c.joinLobby(`Player ${i}`);const view=c.sessionState(token,5000);assert.equal(view.session.host,true);assert.equal(view.session.playerId,'p01');assert.equal(view.session.tableNumber,c.data.players[0].tableNumber);assert.equal(view.session.tableKey,`ABC123-T${view.session.tableNumber}`);assert.equal(view.tournament.players.some(p=>'token'in p),false)});

test('duplicate names are rejected case-insensitively before seating changes',()=>{const c=lobby(),before=structuredClone(c.data);assert.throws(()=>c.joinLobby('host'),/already registered/);assert.deepEqual(c.data,before)});

test('provisioned lobby locks further entrants so child rosters cannot drift',()=>{const c=lobby();c.data.tables[0].provisioned=true;assert.throws(()=>c.joinLobby('Late Player'),/locked for start/);assert.equal(c.data.players.length,1)});

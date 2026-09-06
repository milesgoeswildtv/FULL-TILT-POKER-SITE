import test from'node:test';
import assert from'node:assert/strict';
import{nextTestBotName,TEST_BOT_NAMES}from'../worker/test-bot.js';
test('test bot names are unique until pool exhausted',()=>{const players=[];for(const name of TEST_BOT_NAMES){const next=nextTestBotName(players);assert.equal(next,name);players.push({name,testBot:true})}});
test('bot names fall back safely after pool exhausted',()=>{const players=TEST_BOT_NAMES.map(name=>({name,testBot:true}));assert.equal(nextTestBotName(players),'Test Bot 9')});

import test from'node:test';import assert from'node:assert/strict';import{actionLogText}from'../worker/action-log.js';
test('short stack call logs only chips actually paid',()=>assert.equal(actionLogText({type:'call',name:'Sam',beforeBet:0,beforeChips:30,currentBet:100}),'Sam called all-in for 30'));
test('normal call logs exact call amount',()=>assert.equal(actionLogText({type:'call',name:'Sam',beforeBet:40,beforeChips:500,currentBet:100}),'Sam called 60'));
test('raise logs requested validated target independent of post-action street reset',()=>assert.equal(actionLogText({type:'raise',name:'Sam',beforeBet:20,beforeChips:980,currentBet:40,amount:140}),'Sam raised to 140'));
test('raising all-in logs pre-action stack target',()=>assert.equal(actionLogText({type:'allin',name:'Sam',beforeBet:20,beforeChips:180,currentBet:100}),'Sam went all-in to 200'));
test('all-in call logs amount committed rather than table bet',()=>assert.equal(actionLogText({type:'allin',name:'Sam',beforeBet:20,beforeChips:50,currentBet:100}),'Sam called all-in for 50'));

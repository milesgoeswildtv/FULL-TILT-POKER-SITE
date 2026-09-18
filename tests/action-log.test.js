import test from'node:test';
import assert from'node:assert/strict';
import{actionLogText,completedHandActionLog}from'../worker/action-log.js';
import{PokerTable}from'../worker/app.js';

test('short stack call logs only chips actually paid',()=>assert.equal(actionLogText({type:'call',name:'Sam',beforeBet:0,beforeChips:30,currentBet:100}),'Sam called all-in for 30'));
test('normal call logs exact call amount',()=>assert.equal(actionLogText({type:'call',name:'Sam',beforeBet:40,beforeChips:500,currentBet:100}),'Sam called 60'));
test('raise logs requested validated target independent of post-action street reset',()=>assert.equal(actionLogText({type:'raise',name:'Sam',beforeBet:20,beforeChips:980,currentBet:40,amount:140}),'Sam raised to 140'));
test('raising all-in logs pre-action stack target',()=>assert.equal(actionLogText({type:'allin',name:'Sam',beforeBet:20,beforeChips:180,currentBet:100}),'Sam went all-in to 200'));
test('all-in call logs amount committed rather than table bet',()=>assert.equal(actionLogText({type:'allin',name:'Sam',beforeBet:20,beforeChips:50,currentBet:100}),'Sam called all-in for 50'));

test('completed hand snapshot keeps only that hand and sanitizes public fields',()=>{
 const log=[
  {id:'old',at:1,handNumber:6,street:'river',type:'call',text:'Old hand'},
  {id:'start',at:2,handNumber:7,street:'preflop',type:'hand',text:'Hand #7 started'},
  {id:'raise',at:3,handNumber:7,street:'flop',type:'raise',text:'Sam raised to 500',playerId:'p1',secret:'nope'},
  {id:'timeout',at:4,handNumber:7,street:'turn',type:'timeout',text:'Ruby timed out and folded',playerId:'p2'}
 ];
 const snap=completedHandActionLog(log,7);
 assert.equal(snap.length,3);
 assert.deepEqual(snap.map(x=>x.street),['preflop','flop','turn']);
 assert.equal(snap[1].text,'Sam raised to 500');
 assert.equal('secret'in snap[1],false);
 log[2].text='mutated';
 assert.equal(snap[1].text,'Sam raised to 500');
});

test('PokerTable recordHand embeds an immutable action snapshot into recent hands',()=>{
 const table=new PokerTable({storage:{}},{});
 table.data={handNumber:12,actionLog:[
  {id:'a',at:10,handNumber:12,street:'preflop',type:'hand',text:'Hand #12 started'},
  {id:'b',at:11,handNumber:12,street:'river',type:'call',text:'Sam called 80',playerId:'p1'}
 ],handHistory:[],lastResult:null};
 const entry=table.recordHand({summary:'Sam won 200',board:['A♠','K♠','Q♠','J♠','T♠'],pots:[{amount:200,winners:['Sam']}]});
 assert.equal(entry.actionLog.length,2);
 assert.equal(entry.actionLog[1].text,'Sam called 80');
 assert.equal(table.data.handHistory[0].actionLog[0].handNumber,12);
 table.data.actionLog[1].text='changed later';
 assert.equal(table.data.handHistory[0].actionLog[1].text,'Sam called 80');
});

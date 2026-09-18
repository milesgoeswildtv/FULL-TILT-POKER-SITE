const PREFIX='game:';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanKind(value){return value==='tournament'?'tournament':value==='table'?'table':null}
function cleanCode(value){const code=String(value||'').trim().toUpperCase();return/^[A-Z0-9]{6}$/.test(code)?code:null}
function terminal(status){return status==='finished'||status==='ended'}
function gameKey(kind,code){return PREFIX+kind+':'+code}
function safeText(value,max=80){return String(value||'').slice(0,max)}
function compactRecord(record={}){
 return{
  kind:record.kind,
  code:record.code,
  hostAccountId:safeText(record.hostAccountId,160)||null,
  hostName:safeText(record.hostName,64)||null,
  createdAt:Number(record.createdAt)||null,
  startedAt:Number(record.startedAt)||null,
  finishedAt:Number(record.finishedAt)||null,
  endedAt:Number(record.endedAt)||null,
  lastActivityAt:Number(record.lastActivityAt)||Number(record.createdAt)||null,
  status:safeText(record.status,24)||'lobby',
  playerCount:Math.max(0,Math.trunc(Number(record.playerCount)||0)),
  playerNames:Array.isArray(record.playerNames)?record.playerNames.map(x=>safeText(x,64)).filter(Boolean).slice(0,50):[],
  winnerName:safeText(record.winnerName,64)||null,
  adminEvents:Array.isArray(record.adminEvents)?record.adminEvents.slice(-100):[],
  finalSnapshot:record.finalSnapshot||null
 }
}

export class GameRegistry{
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async get(kind,code){return await this.ctx.storage.get(gameKey(kind,code))||null}
 async put(record){const clean=compactRecord(record);await this.ctx.storage.put(gameKey(clean.kind,clean.code),clean);return clean}
 async list(){
  const rows=await this.ctx.storage.list({prefix:PREFIX}),games=[];
  for(const value of rows.values())if(value?.kind&&value?.code)games.push(compactRecord(value));
  games.sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  return games
 }
 async fetch(req){
  const u=new URL(req.url);let body={};if(req.method==='POST')try{body=await req.json()}catch{}
  if(u.pathname==='/record'&&req.method==='POST'){
   const kind=cleanKind(body.kind),code=cleanCode(body.code);if(!kind||!code)return json({error:'Valid game kind and code required.'},400);
   const existing=await this.get(kind,code),now=Date.now(),next={...(existing||{}),kind,code,hostAccountId:body.hostAccountId??existing?.hostAccountId??null,hostName:body.hostName??existing?.hostName??null,createdAt:Number(existing?.createdAt)||Number(body.createdAt)||now,lastActivityAt:Math.max(Number(existing?.lastActivityAt)||0,Number(body.lastActivityAt)||now),status:String(body.status||existing?.status||'lobby')};
   return json({game:await this.put(next)},existing?200:201)
  }
  if(u.pathname==='/snapshot'&&req.method==='POST'){
   const kind=cleanKind(body.kind),code=cleanCode(body.code);if(!kind||!code)return json({error:'Valid game kind and code required.'},400);
   const existing=await this.get(kind,code)||{kind,code,createdAt:Date.now()},summary=body.summary&&typeof body.summary==='object'?body.summary:{},status=String(summary.status||existing.status||'lobby'),players=Array.isArray(summary.players)?summary.players:[],winner=summary.winner&&typeof summary.winner==='object'?summary.winner:null;
   const next={...existing,kind,code,status,startedAt:Number(summary.startedAt)||existing.startedAt||null,finishedAt:Number(summary.finishedAt)||existing.finishedAt||null,endedAt:Number(summary.endedAt)||existing.endedAt||null,lastActivityAt:Number(summary.lastActivityAt)||Date.now(),playerCount:Math.max(0,Math.trunc(Number(summary.playerCount??players.length)||0)),playerNames:players.map(p=>safeText(p?.name,64)).filter(Boolean).slice(0,50),winnerName:safeText(winner?.name||summary.winnerName,64)||existing.winnerName||null};
   if(terminal(status))next.finalSnapshot=summary;
   return json({game:await this.put(next)})
  }
  if(u.pathname==='/event'&&req.method==='POST'){
   const kind=cleanKind(body.kind),code=cleanCode(body.code);if(!kind||!code)return json({error:'Valid game kind and code required.'},400);
   const existing=await this.get(kind,code)||{kind,code,createdAt:Date.now(),status:'unknown'},event={id:crypto.randomUUID(),at:Number(body.at)||Date.now(),action:safeText(body.action,40),result:safeText(body.result,120),note:safeText(body.note,240)};
   existing.adminEvents=[...(existing.adminEvents||[]),event].slice(-100);existing.lastActivityAt=Math.max(Number(existing.lastActivityAt)||0,event.at);return json({event,game:await this.put(existing)},201)
  }
  if(u.pathname==='/get'&&req.method==='GET'){
   const kind=cleanKind(u.searchParams.get('kind')),code=cleanCode(u.searchParams.get('code'));if(!kind||!code)return json({error:'Valid game kind and code required.'},400);const game=await this.get(kind,code);return game?json({game:compactRecord(game)}):json({error:'Game is not indexed.'},404)
  }
  if(u.pathname==='/list'&&req.method==='GET'){const games=await this.list();return json({games,count:games.length})}
  return json({error:'Not found.'},404)
 }
}

export function isTerminalGameStatus(status){return terminal(String(status||''))}

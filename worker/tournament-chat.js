const KEY='messages',LIMIT=100,COOLDOWN_MS=700;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,24)}
function cleanMessage(v){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,280)}
function cleanId(v){return String(v||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64)}
export class TournamentChat{
 constructor(state){this.state=state;this.messages=null}
 async load(){if(this.messages)return;this.messages=await this.state.storage.get(KEY)||[]}
 async save(){await this.state.storage.put(KEY,this.messages)}
 async fetch(req){await this.load();const u=new URL(req.url);
  if(u.pathname==='/state'&&req.method==='GET')return json({messages:this.messages.slice(-LIMIT)});
  if(u.pathname==='/message'&&req.method==='POST'){
   const b=await req.json().catch(()=>({})),senderId=cleanId(b.senderId),name=cleanName(b.name),message=cleanMessage(b.message),tableNumber=Math.max(0,Math.trunc(Number(b.tableNumber)||0));
   if(!senderId||!name)return json({error:'Authenticated tournament player required.'},403);if(!message)return json({error:'Message required.'},400);
   const now=Date.now(),last=[...this.messages].reverse().find(m=>m.senderId===senderId);if(last&&now-last.at<COOLDOWN_MS)return json({error:'Slow down.'},429);
   this.messages.push({id:crypto.randomUUID(),type:'message',senderId,name,message,tableNumber:tableNumber||null,at:now});this.messages=this.messages.slice(-LIMIT);await this.save();return json({ok:true,messages:this.messages});
  }
  return json({error:'Not found.'},404)
 }
}

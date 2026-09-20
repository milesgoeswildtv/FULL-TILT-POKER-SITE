import{normalizeThrowableId}from'../shared/throwables.js';

export const THROWABLE_COOLDOWN_MS=900;

function fail(message,status){throw Object.assign(Error(message),{status})}

export function createThrowableEvent({sender,players=[],street='',targetId,throwableId,lastThrownAt=0,now=Date.now(),eventId}={}){
 if(!sender||sender.testBot)fail('Player session required.',403);
 if(street==='finished')fail('Throwables are not available after the game closes.',409);
 const id=normalizeThrowableId(throwableId);if(!id)fail('Unknown throwable.',400);
 const target=players.find(player=>player.id===String(targetId||''));if(!target)fail('Target player not found.',404);
 if(target.id===sender.id)fail('Choose another player.',400);
 if(now-Number(lastThrownAt||0)<THROWABLE_COOLDOWN_MS)fail('Slow down.',429);
 if(!eventId)fail('Throwable event id required.',500);
 return{id:String(eventId),throwableId:id,senderId:sender.id,targetId:target.id,at:now};
}

export const POSTGAME_WINDOW_MS=10*60*1000;

export function terminalGameAt(data){
 if(!data)return null;
 const value=Number(data.endedAt||data.finishedAt||0);
 return value>0?value:null;
}
export function armPostgame(data,now=Date.now()){
 if(!data)return null;
 const terminalAt=terminalGameAt(data)||Number(now)||Date.now();
 if(!data.finishedAt&&!data.endedAt)data.finishedAt=terminalAt;
 if(!Number(data.postgameEndsAt))data.postgameEndsAt=terminalAt+POSTGAME_WINDOW_MS;
 return Number(data.postgameEndsAt);
}
export function postgameExpired(data,now=Date.now()){
 return!!(data?.postgameExpiredAt||(Number(data?.postgameEndsAt)>0&&Number(now)>=Number(data.postgameEndsAt)));
}
export function postgameRemainingMs(data,now=Date.now()){
 const end=Number(data?.postgameEndsAt)||0;
 return end?Math.max(0,end-Number(now||Date.now())):null;
}
export function postgameFields(data,now=Date.now()){
 return{postgameEndsAt:Number(data?.postgameEndsAt)||null,postgameExpiredAt:Number(data?.postgameExpiredAt)||null,postgameRemainingMs:postgameRemainingMs(data,now)};
}

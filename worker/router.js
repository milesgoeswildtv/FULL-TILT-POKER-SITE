import app from'./app.js';
import{healthResponse}from'./health.js';
import{handleTournamentApi}from'./mtt-public.js';
export{PokerTable}from'./app.js';
export{TournamentCoordinator}from'./tournament-coordinator.js';

const SECURITY_HEADERS={
 'x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'referrer-policy':'no-referrer',
 'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()'
};
export function hardenResponse(response){if(!response||response.status===101||response.webSocket)return response;const headers=new Headers(response.headers);for(const[key,value]of Object.entries(SECURITY_HEADERS))headers.set(key,value);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}

export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/api/health')return hardenResponse(healthResponse());const tournamentResponse=await handleTournamentApi(req,env),response=tournamentResponse||await app.fetch(req,env,ctx);return hardenResponse(response)}};

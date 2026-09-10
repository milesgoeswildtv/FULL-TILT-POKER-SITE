import app from'./app.js';
import{handleTournamentApi}from'./mtt-public.js';
import{healthResponse}from'./health.js';
export{PokerTable}from'./app.js';
export{TournamentCoordinator}from'./tournament-coordinator.js';

export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/api/health')return healthResponse();const response=await handleTournamentApi(req,env);if(response)return response;return app.fetch(req,env,ctx)}};

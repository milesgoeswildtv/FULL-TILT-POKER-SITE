const ACTIVE_STREETS=new Set(['preflop','flop','turn','river']);

function contributedTotal(data){return(data.players||[]).reduce((sum,p)=>sum+Math.max(0,Number(p.contributed)||0),0)}
function clearPlayerHandState(player){player.bet=0;player.contributed=0;player.folded=false;player.cards=[];player.vpipThisHand=false;player.pfrThisHand=false}
function clearHandState(data){data.board=[];data.burned=[];data.deck=[];data.pot=0;data.currentBet=0;data.openingBet=0;data.minRaise=data.bigBlind||data.minRaise||0;data.acted={};data.actedAtBet={};data.fairness=null;for(const p of data.players||[])clearPlayerHandState(p)}

export function abortActiveHand(data){
 if(!data)throw Error('Table not found.');
 if(!ACTIVE_STREETS.has(data.street)){clearHandState(data);return{aborted:false,refunded:0}}
 const committed=contributedTotal(data),pot=Math.max(0,Number(data.pot)||0);
 if(committed!==pot)throw Error(`Hand abort invariant failed: contributed ${committed}, live pot ${pot}.`);
 for(const p of data.players||[])p.chips+=Math.max(0,Number(p.contributed)||0);
 clearHandState(data);
 return{aborted:true,refunded:committed};
}

export function endTournamentState(data,now=Date.now()){
 if(!data)throw Error('Table not found.');
 const outcome=abortActiveHand(data);
 data.started=false;
 data.paused=false;
 data.pausedAt=null;
 data.turnRemainingMs=null;
 data.phaseRemainingMs=null;
 data.turnDeadline=null;
 data.phaseDeadline=null;
 data.street='finished';
 data.endedByHost=true;
 data.endedAt=now;
 data.message=outcome.aborted?`Tournament ended by host. Active hand cancelled; ${outcome.refunded.toLocaleString()} chips returned.`:'Tournament ended by host.';
 return data;
}

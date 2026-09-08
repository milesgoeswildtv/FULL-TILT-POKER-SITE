export function endTournamentState(data,now=Date.now()){
 if(!data)throw Error('Table not found.');
 data.started=false;
 data.paused=false;
 data.pausedAt=null;
 data.turnRemainingMs=null;
 data.turnDeadline=null;
 data.phaseDeadline=null;
 data.street='finished';
 data.endedByHost=true;
 data.endedAt=now;
 data.message='Tournament ended by host.';
 return data;
}

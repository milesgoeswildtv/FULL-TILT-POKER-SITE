function int(v,fallback=0){const n=Math.trunc(Number(v));return Number.isFinite(n)?n:fallback}
function isNonNegativeInteger(v){const n=Number(v);return Number.isInteger(n)&&n>=0}
function isPositiveInteger(v){const n=Number(v);return Number.isInteger(n)&&n>=1}
function rowStats(stats={}){return{handsPlayed:Math.max(0,int(stats.handsPlayed)),handsWon:Math.max(0,int(stats.handsWon)),vpipHands:Math.max(0,int(stats.vpipHands)),pfrHands:Math.max(0,int(stats.pfrHands)),biggestPotWon:Math.max(0,int(stats.biggestPotWon)),knockouts:Math.max(0,Number(stats.knockouts)||0),chipsWon:Math.max(0,int(stats.chipsWon))}}
function canonicalRow(row={}){return{id:String(row.id||''),ownershipGeneration:Math.max(1,int(row.ownershipGeneration,1)),chips:Math.max(0,int(row.chips)),eliminated:!!row.eliminated,handStartChips:Math.max(0,int(row.handStartChips)),stats:rowStats(row.stats),cosmetic:String(row.cosmetic||'default')}}

export function validateBoundaryShape(report={}){
 if(!Array.isArray(report.players))throw Error('Table report players required.');
 const sequence=report.boundarySequence??report.handNumber;if(!isPositiveInteger(sequence))throw Error('Tournament boundary sequence must be a positive integer.');
 if(!isNonNegativeInteger(report.handNumber))throw Error('Tournament hand number must be a non-negative integer.');
 if(report.reportGeneration!=null&&!isPositiveInteger(report.reportGeneration))throw Error('Tournament report generation must be a positive integer.');
 if(report.completedAt!=null&&!isNonNegativeInteger(report.completedAt))throw Error('Tournament boundary completion time is invalid.');
 if(report.nextBigBlindPlayerId!=null&&typeof report.nextBigBlindPlayerId!=='string')throw Error('Tournament next big blind player id is invalid.');
 for(const row of report.players){if(!row||typeof row!=='object'||!String(row.id||''))throw Error('Tournament report player id required.');if(!isPositiveInteger(row.ownershipGeneration??1))throw Error('Tournament player ownership generation is invalid.');if(!isNonNegativeInteger(row.chips))throw Error('Tournament player chips must be a non-negative integer.');if(row.handStartChips!=null&&!isNonNegativeInteger(row.handStartChips))throw Error('Tournament hand-start chips must be a non-negative integer.');}
 return true;
}

export function normalizeBoundaryReport(report={},fallbackGeneration=1){
 validateBoundaryShape(report);const rows=report.players.map(canonicalRow),nextBigBlindPlayerId=String(report.nextBigBlindPlayerId||'')||null;
 return{reportGeneration:Math.max(1,int(report.reportGeneration,fallbackGeneration)),boundarySequence:Math.max(1,int(report.boundarySequence,report.handNumber)),handNumber:Math.max(0,int(report.handNumber)),completedAt:Math.max(0,int(report.completedAt)),status:String(report.status||'running'),nextBigBlindPlayerId,players:rows};
}

export function boundaryFingerprint(report){
 const r=normalizeBoundaryReport(report,report?.reportGeneration||1),players=[...(r.players||[])].sort((a,b)=>a.id.localeCompare(b.id));
 return JSON.stringify({reportGeneration:r.reportGeneration,boundarySequence:r.boundarySequence,handNumber:r.handNumber,completedAt:r.completedAt,status:r.status,nextBigBlindPlayerId:r.nextBigBlindPlayerId,players});
}

export function validateBoundaryHeader(table,rawReport){
 if(!table)throw Error('Tournament table not found.');
 const report=normalizeBoundaryReport(rawReport,table.reportGeneration||1),last=Math.max(0,int(table.lastBoundarySequence)),fingerprint=boundaryFingerprint(report);
 if(report.boundarySequence===last){if(last>0&&fingerprint===table.lastBoundaryFingerprint)return{kind:'duplicate',report,fingerprint};throw Error('Conflicting duplicate tournament boundary report.');}
 if(report.boundarySequence<last)throw Error('Stale tournament boundary report.');
 if(report.boundarySequence!==last+1)throw Error(`Tournament boundary sequence gap: expected ${last+1}, received ${report.boundarySequence}.`);
 if(report.reportGeneration!==Math.max(1,int(table.reportGeneration,1)))throw Error('Tournament table report generation is stale.');
 if(report.handNumber<table.handNumber)throw Error('Tournament hand number cannot move backward.');
 return{kind:'new',report,fingerprint};
}

export function validateCompleteRoster(expectedPlayers,rows){
 const expected=[...(expectedPlayers||[])],byId=new Map(expected.map(p=>[p.id,p]));if(byId.size!==expected.length)throw Error('Coordinator roster contains duplicate player identity.');
 const seen=new Set();for(const row of rows||[]){if(!row.id)throw Error('Tournament report player id required.');if(seen.has(row.id))throw Error('Tournament report contains duplicate player rows.');seen.add(row.id);const expectedPlayer=byId.get(row.id);if(!expectedPlayer)throw Error('Table reported a player it does not own.');if(Math.max(1,int(row.ownershipGeneration,1))!==Math.max(1,int(expectedPlayer.ownershipGeneration,1)))throw Error('Tournament player ownership generation is stale.');}
 if(seen.size!==byId.size||[...byId.keys()].some(id=>!seen.has(id)))throw Error('Tournament boundary report must contain the complete owned roster.');
 return true;
}

export function validateNextBigBlind(report){
 const active=(report?.players||[]).filter(row=>row.chips>0&&!row.eliminated);if(active.length<2){if(report.nextBigBlindPlayerId)throw Error('Singleton tournament table cannot report a next big blind player.');return true}
 if(!report.nextBigBlindPlayerId||!active.some(row=>row.id===report.nextBigBlindPlayerId))throw Error('Tournament boundary must identify the active player due the next big blind.');return true;
}

export function assertBoundaryChipConservation(expectedPlayers,rows){
 const before=(expectedPlayers||[]).reduce((sum,p)=>sum+Math.max(0,int(p.chips)),0),after=(rows||[]).reduce((sum,p)=>sum+Math.max(0,int(p.chips)),0);if(before!==after)throw Error(`Tournament chip invariant failed at boundary: expected ${before}, reported ${after}.`);return before;
}

export function eliminationEvent({tableNumber,report,player}){return{id:`${Number(tableNumber)}:${report.boundarySequence}:${player.id}`,playerId:player.id,tableNumber:Number(tableNumber),boundarySequence:report.boundarySequence,completedAt:Math.max(0,int(report.completedAt)),handStartChips:Math.max(0,int(player.handStartChips))}}

export function recomputeEliminationPlaces(data){
 data.eliminationLedger??=[];const events=[...data.eliminationLedger].sort((a,b)=>a.completedAt-b.completedAt||a.handStartChips-b.handStartChips||a.tableNumber-b.tableNumber||a.playerId.localeCompare(b.playerId)),byPlayer=new Map(events.map((event,index)=>[event.playerId,data.players.length-index]));
 for(const p of data.players){if(p.eliminated)p.finishPlace=byPlayer.get(p.id)??p.finishPlace??null;else p.finishPlace=null}
 const active=data.players.filter(p=>!p.eliminated&&p.chips>0);if(active.length===1)active[0].finishPlace=1;return active;
}

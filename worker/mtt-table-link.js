export function tournamentStub(env,code){if(!env?.TOURNAMENTS||!code)throw Error('Tournament binding unavailable.');return env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(String(code)))}

async function readJson(response){const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||`Tournament coordinator returned ${response.status}.`);return body}

export async function syncTournamentTable(env,{tournamentCode,tableNumber}){
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/sync`));
 return readJson(response);
}

export async function reportTournamentTable(env,{tournamentCode,tableNumber,handNumber,status,players}){
 const stub=tournamentStub(env,tournamentCode),response=await stub.fetch(new Request(`https://tournament/tables/${Number(tableNumber)}/report`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handNumber,status,players})}));
 return readJson(response);
}

export function applyTournamentBlinds(tableData,snapshot){
 if(!tableData||!snapshot?.handBlinds)return false;
 const b=snapshot.handBlinds;tableData.blindLevel=Number(b.blindLevel)||0;tableData.smallBlind=Math.max(1,Math.trunc(Number(b.smallBlind)||1));tableData.bigBlind=Math.max(tableData.smallBlind,Math.trunc(Number(b.bigBlind)||tableData.smallBlind));tableData.minRaise=tableData.bigBlind;tableData.tournamentClock=snapshot.clock||null;return true;
}

export function tournamentTableReport(tableData){
 return{handNumber:tableData?.handNumber||0,status:tableData?.street==='finished'?'finished':tableData?.paused?'paused':'running',players:(tableData?.players||[]).map(p=>({id:p.tournamentPlayerId||p.id,chips:Math.max(0,Math.trunc(Number(p.chips)||0)),eliminated:!!p.eliminated,finishPlace:Number.isInteger(p.finishPlace)?p.finishPlace:null}))};
}

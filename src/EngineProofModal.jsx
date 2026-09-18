import React,{useEffect,useState}from'react';
import'./engine-proof.css';

const STATS=[
 ['25,000','Randomized side-pot settlement cases'],
 ['500','Complete randomized 2–9 player tournaments'],
 ['5,905','Hands in randomized table runs'],
 ['13,084','Player actions'],
 ['755','Rabbit Hunts validated'],
 ['2,941','Hand Replayer validations'],
 ['50','Complete 50-player MTTs'],
 ['2,500','MTT entrants'],
 ['810','MTT hands'],
 ['3,483','MTT actions'],
 ['25','MTTs with Big Blind Ante'],
 ['281 / 281','Final automated tests passed']
];

function Why({openAudit}){
 return <div className="engineProofBody">
  <div className="engineProofIntro"><span>THE CRASHOUT POKER ENGINE</span><h2>Why is our engine different?</h2><p>Crashout Poker is built around one rule: <b>the server owns the game.</b> The website and Telegram Mini App are two ways into the same authoritative poker system.</p></div>
  <div className="engineProofGrid">
   <article><b>SERVER-AUTHORITATIVE PLAY</b><p>The client requests an action. The engine validates it, applies it, persists the state and broadcasts the result. Cards, chips, winners and pot math are never decided by the browser.</p></article>
   <article><b>ONE ENGINE. TWO PLATFORMS.</b><p>Website and Telegram players use the same PokerTable, TournamentCoordinator, settlement logic, shuffle, clocks and real-time game state.</p></article>
   <article><b>STRICT CHIP ACCOUNTING</b><p>Main pots, side pots, uncalled returns and odd chips are reconciled against actual contributions. If the math does not balance, the engine fails instead of silently losing or creating chips.</p></article>
   <article><b>STRICT BETTING RULES</b><p>Calls, raises, short all-ins, raise reopening, short blinds, heads-up order and Big Blind Ante are treated as game rules instead of UI shortcuts.</p></article>
   <article><b>FRESH DECK STATE</b><p>Every hand starts from a fresh 52-card deck using a cryptographically secure Fisher-Yates shuffle with rejection sampling, plus deck-integrity checks.</p></article>
   <article><b>ONE TOURNAMENT AUTHORITY</b><p>A dedicated coordinator owns MTT seating, table moves, table breaks, eliminations, finish order and shared blind levels.</p></article>
   <article><b>FEATURES STAY OUT OF SETTLEMENT</b><p>Time Bank, Sit Out, Hand Replayer and Rabbit Hunt sit around the core result logic. Rabbit Hunt never changes the real board, pot, stacks or winner.</p></article>
   <article><b>TESTED AS A SYSTEM</b><p>Complete tables and full 50-player tournaments are simulated through the real engine while chip supply, ownership, finish order, replay privacy and deck integrity are asserted.</p></article>
  </div>
  <div className="engineProofCallout"><strong>THE POINT</strong><p>The presentation can evolve without rewriting the rules underneath it. The engine is treated as infrastructure first.</p></div>
  <button className="engineAuditLaunch" type="button" onClick={openAudit}><span>ENGINE AUDIT</span><small>Read the full mass-simulation results</small><em>›</em></button>
 </div>
}

function Audit({back}){
 return <div className="engineProofBody auditView">
  <div className="engineProofIntro"><span>ENGINE AUDIT • SEPTEMBER 18, 2026</span><h2>Mass Simulation Audit</h2><div className="auditGreen"><b>100% GREEN</b><small>Final audit suite: 281 / 281 tests passed • 0 failures</small></div><p>The production poker engine was pushed through thousands of complete poker states after Hand Replayer and Rabbit Hunt were merged. Core invariants were continuously checked throughout the entire simulation run.</p></div>
  <section className="auditSection"><h3>Audit volume</h3><div className="auditStatGrid">{STATS.map(([v,l])=><div key={l}><b>{v}</b><span>{l}</span></div>)}</div></section>
  <section className="auditSection"><h3>25,000 randomized settlement cases</h3><p>Randomized valid contribution structures covered uneven commitments, multiple all-in levels, folded contributors, ties, side pots and uncalled chips.</p><div className="auditChecks"><span>✓ Every contributed chip was accounted for</span><span>✓ Awards plus returns always equaled total contributions</span><span>✓ Contested pots plus returns reconciled exactly</span><span>✓ No negative or fractional chip result was accepted</span></div></section>
  <section className="auditSection"><h3>500 complete randomized 2–9 player tournaments</h3><p>Five hundred full tournaments ran through the real PokerTable from the opening hand until one player held the complete chip supply: 5,905 hands and 13,084 actions.</p><div className="auditChecks"><span>✓ Total chip supply remained constant</span><span>✓ Stacks, bets, contributions and pots stayed valid</span><span>✓ Every tournament produced exactly one surviving winner</span><span>✓ The final winner held the complete original table chip supply</span><span>✓ 755 Rabbit Hunts left the live deck, board, stacks and result untouched</span><span>✓ 2,941 replay validations confirmed usable replay data without exposing hidden hole cards through normal public state</span></div></section>
  <section className="auditSection"><h3>50 complete 50-player MTT simulations</h3><p>Fifty full tournaments ran through real child PokerTable instances and the real TournamentCoordinator: 2,500 entrants, 810 completed hands and 3,483 actions. Twenty-five runs used Big Blind Ante.</p><div className="auditChecks"><span>✓ Tournament chip supply stayed exact</span><span>✓ No active player occupied two tables at once</span><span>✓ No active table contained duplicate occupied seats</span><span>✓ Every active player remained owned by one tournament table</span><span>✓ Finish positions were unique and complete from 1 through 50</span><span>✓ Each tournament ended with one winner holding the original tournament chip supply</span><span>✓ Big Blind Ante remained compatible with the MTT lifecycle</span></div></section>
  <section className="auditSection"><h3>Final validation</h3><p>The mass simulations ran alongside the existing automated suite. The final run finished with <b>281 passed, 0 failed</b>, followed by successful production dependency audit, full dependency audit, production build and Cloudflare Worker dry-run.</p><div className="auditFinal"><b>FINAL STATUS: GREEN</b><p>No launch-blocking poker-engine defect was exposed by the published audit suite.</p></div></section>
  <section className="auditSection sharedEngineNote"><h3>Website + Telegram</h3><p>Both clients connect to the same authoritative PokerTable and TournamentCoordinator backend. The engine audited above is the engine used by both.</p></section>
  <button className="engineAuditLaunch back" type="button" onClick={back}><span>BACK TO WHY</span><small>Return to the engine overview</small><em>‹</em></button>
 </div>
}

export default function EngineProofModal({onClose}){
 const[view,setView]=useState('why');
 useEffect(()=>{const fn=e=>{if(e.key==='Escape')onClose?.()};addEventListener('keydown',fn);return()=>removeEventListener('keydown',fn)},[onClose]);
 const switchView=next=>{setView(next);requestAnimationFrame(()=>document.querySelector('.engineProofModal')?.scrollTo?.({top:0,behavior:'smooth'}))};
 return <div className="engineProofShade" role="dialog" aria-modal="true" aria-label="Crashout Poker engine information" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}><section className="engineProofModal"><header className="engineProofHead"><div><small>CRASHOUT POKER</small><b>{view==='audit'?'ENGINE AUDIT':'ENGINE ARCHITECTURE'}</b></div><button type="button" onClick={onClose} aria-label="Close engine information">×</button></header>{view==='why'?<Why openAudit={()=>switchView('audit')}/>:<Audit back={()=>switchView('why')}/>}</section></div>
}

# FULL TILT POKER SITE

Private play-chip No-Limit Texas Hold’em for the Full Tilt community, built as a React/Vite frontend on a Cloudflare Worker with Durable Objects.

## Current build — v0.46

### Poker engine
- Server-authoritative shuffled deck; hidden cards/deck are never exposed to other clients
- Fold / check / call / raise / all-in flow
- Contribution-based main and side pots for unequal all-ins
- Deterministic odd-chip settlement
- Automatic board runout when all remaining players are all-in
- Heads-up blind/action handling
- Exact showdown awards, hand history, action log, player stats and cosmetics
- Session persistence and reconnect support
- Read-only spectators and realtime table chat

### Private tables
- 2–9 players
- Private 6-character table codes
- Host-selectable starting stacks and blind structures
- Host start / pause / resume / pre-game kick / end controls
- Automatic elimination at zero chips and last-stack-standing finish

### Multi-table tournaments
- Up to 50 players across shared 8-max child tables
- One `TournamentCoordinator` Durable Object owns the global tournament state
- Separate `PokerTable` Durable Objects run each active table
- Coordinator provisions and seats child tables at tournament start
- One global blind clock; each table snapshots the current level only when beginning a new hand
- Safe-boundary table balancing and table breaks
- Player identity, stack, stats, cosmetics and tournament session survive table moves
- Automatic table-change/reconnect UX
- Global field count and standings
- Elimination/result screens and final champion standings
- Tournament Director pause/resume-all and explicit end-tournament controls

## Cloudflare architecture

`TABLES` → `PokerTable` Durable Objects  
`TOURNAMENTS` → `TournamentCoordinator` Durable Objects  
`ASSETS` → built Vite frontend

Wrangler migrations currently contain both Durable Object classes. Do not remove or rename those migration entries on an existing deployment.

## Verification

Every push to `main` runs GitHub Actions against Node 22:

```bash
npm install
npm run audit:prod
npm run audit:all
npm test
npm run build
npm run check:worker
```

The final command performs a Wrangler deployment dry-run and validates the Cloudflare bindings/configuration without publishing.

## Local commands

```bash
npm install
npm run dev
npm test
npm run build
npm run check:worker
npm run deploy
```

`npm run deploy` is the real Cloudflare deployment command. Run it only from an authenticated Cloudflare environment after CI is green.

## Scope

This site uses play chips only. Any arrangements outside the game are outside the application.

# FULL TILT POKER SITE

Private play-chip No-Limit Texas Hold’em for the Full Tilt community, built as a React/Vite frontend on a Cloudflare Worker with Durable Objects.

## Current build — v0.53

### Accounts + home
- Discord OAuth is required before poker APIs can be used
- Discord username/avatar become the player’s Full Tilt identity
- Persistent `PlayerAccount` Durable Object per Discord user
- Direct table/tournament invite links stop for Discord login when necessary and return the player to the same invite after OAuth
- Quick-table and tournament seats are privately linked to the Discord account ID; account IDs are not exposed in public table/tournament state
- Lifetime hands played, knockouts, chips won and biggest pot are checkpointed to the account with retry-safe/idempotent deltas
- Natural MTT finishes add tournament played, tournament win and final-table results exactly once
- Discord-first home screen with Create Game, Join Game, profile drawer and Booster Shop
- Booster loadouts are account-authoritative: players equip owned boosters from their profile and the server applies that loadout at the table
- The former free in-table cosmetic picker has been removed
- The home page exposes public Terms, Cosmetic Purchase, Refund, Privacy, and Contact/Support policies

### Stripe Booster Shop
- Stripe-hosted Checkout is wired for Constellation, Dead Man’s Hand, and Regalia
- Checkout is created server-side from fixed Stripe Price IDs; the browser never supplies an amount
- Checkout requires the authenticated Discord account and refuses a second purchase for an already-owned booster
- Stripe Checkout metadata carries the Discord account ID and booster key for fulfillment
- `/api/shop/webhook` verifies the Stripe `Stripe-Signature` HMAC before accepting fulfillment events
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` grant the booster only when Stripe reports the session as paid
- Purchase grants are idempotent by Checkout Session ID, so webhook retries do not duplicate entitlements
- Purchased boosters are stored in the Discord-backed `PlayerAccount` inventory and can then be equipped from Full Tilt
- The shop reads the configured Stripe Price objects server-side so the displayed amount comes from Stripe rather than duplicated frontend pricing
- Returning from successful Checkout polls the account briefly until the webhook-delivered entitlement appears
- Current Stripe configuration is sandbox/test mode; the UI labels the shop as `SANDBOX SHOP`
- Triple Threat has a sandbox Stripe product and price reserved in configuration, but it is not offered for sale yet because Triple Threat game cosmetic assets are not present in the application

### Shop policy + support
- Public policy pages live at `/terms.html`, `/purchases.html`, `/refunds.html`, `/privacy.html`, and `/contact.html`
- Policies explicitly state that Full Tilt is play-chip only and does not offer cash wagering, cash-out, monetary prizes, or purchased gaming currency
- Cosmetic purchase policy limits paid items to visual customization such as card backs, chips, plaques, avatar frames, and coordinated packs
- Refund policy covers duplicate charges, failed fulfillment, technical errors, unauthorized transactions, and rights required by law
- Billing, refund, account, and security support email: `fckthefees@gmail.com`

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
- Discord identity and equipped profile booster are attached when the player takes a seat

### Multi-table tournaments
- Up to 50 players across shared 8-max child tables
- One `TournamentCoordinator` Durable Object owns the global tournament state
- Separate `PokerTable` Durable Objects run each active table
- Coordinator provisions and seats child tables at tournament start
- One global blind clock; each table snapshots the current level only when beginning a new hand
- Safe-boundary table balancing and table breaks
- Player identity, stack, account linkage, cumulative stats, cosmetics and tournament session survive table moves
- Automatic table-change/reconnect UX
- Global field count and standings
- Elimination/result screens and final champion standings
- Natural tournament completion writes an idempotent career result to each linked player account
- Tournament Director pause/resume-all and explicit end-tournament controls

## Cloudflare architecture

`TABLES` → `PokerTable` Durable Objects  
`TOURNAMENTS` → `TournamentCoordinator` Durable Objects  
`TOURNAMENT_CHATS` → `TournamentChat` Durable Objects  
`ACCOUNTS` → `PlayerAccount` Durable Objects  
`ASSETS` → built Vite frontend

All `/api/*` requests are routed through the Worker before SPA asset fallback. Wrangler migrations contain all Durable Object classes. Do not remove or rename migration entries on an existing deployment.

## Discord OAuth configuration

Required Worker secrets:

```text
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
AUTH_SECRET
```

Optional:

```text
DISCORD_REDIRECT_URI
```

If `DISCORD_REDIRECT_URI` is omitted, Full Tilt uses:

```text
https://<current-origin>/api/auth/callback
```

That exact callback URL must also be registered in the Discord application’s OAuth2 redirect list. `AUTH_SECRET` should be a long random secret used only for signing Full Tilt account sessions.

The current workers.dev callback is:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/auth/callback
```

## Stripe configuration

Required Worker secrets:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

For sandbox testing, `STRIPE_SECRET_KEY` should be the Stripe `sk_test_...` secret key. `STRIPE_WEBHOOK_SECRET` is the `whsec_...` signing secret shown for the webhook endpoint after it is created in Stripe. The Stripe publishable key is not required because Full Tilt redirects to Stripe-hosted Checkout rather than embedding Stripe Elements.

Webhook endpoint:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/shop/webhook
```

Subscribe that endpoint to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

Sandbox product/price IDs are stored as non-secret Wrangler vars. Current configured products are Constellation, Dead Man’s Hand, Regalia, and a reserved Triple Threat product. Only the first three are currently purchasable because they have complete in-game cosmetic assets.

When moving to live payments, replace the test product/price IDs with live-mode IDs, set `STRIPE_MODE` to `live`, replace `STRIPE_SECRET_KEY` with the live secret key, and create a live webhook endpoint to obtain the corresponding live `whsec_...` secret.

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

`npm run deploy` is the real Cloudflare deployment command. Run it only from an authenticated Cloudflare environment after CI is green and the required Discord/Stripe secrets are configured.

## Scope

This site uses play chips only. Any arrangements outside the game are outside the application.

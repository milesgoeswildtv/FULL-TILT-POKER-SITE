# FULL TILT POKER SITE

Private play-chip No-Limit Texas Hold’em for the Full Tilt community, built as a React/Vite frontend on a Cloudflare Worker with Durable Objects.

## Current build — v0.54.0

### Accounts + home
- Discord OAuth is required before poker APIs can be used.
- Discord username/avatar become the player’s Full Tilt identity.
- One persistent `PlayerAccount` Durable Object is used per Discord user.
- Lifetime poker stats, owned booster inventory, equipped loadout, purchase ledger, and refund state persist to that account.
- Direct table/tournament invites survive the Discord login round trip.
- Booster loadouts are account-authoritative and are applied by the server when a player takes a seat.

### Stripe Booster Shop
- Stripe-hosted Checkout is wired for Constellation, Dead Man’s Hand, Regalia, and the Triple Threat bundle.
- Triple Threat is one purchase that grants all three existing booster packs; it is not a fourth cosmetic loadout.
- Checkout is created server-side from fixed Stripe Price IDs. The browser never supplies a price or entitlement list.
- The shop reads current Stripe Price objects server-side so displayed prices come from Stripe.
- Managed Payments is explicitly disabled for these Checkout Sessions.
- Checkout Session and PaymentIntent metadata carry the Discord account ID, purchase key, and Full Tilt source marker.
- `/api/shop/webhook` validates `Stripe-Signature` before processing an event.
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` grant paid entitlements.
- Grants are idempotent by Checkout Session ID.
- Successful checkout returns to Full Tilt, waits for webhook fulfillment, then shows the purchase-unlock reveal with immediate equip controls.
- The shop includes detailed previews of card backs, avatar frames, chip sets, and player-plaque states.

### Refund + purchase hardening
- `charge.refunded` webhook events are supported.
- Partial refunds are recorded without removing the cosmetic entitlement.
- A fully refunded purchase is marked refunded and its entitlements are reconciled against the rest of the account’s active purchase ledger.
- Overlapping ownership is preserved. Example: if Constellation was bought separately and Triple Threat is later refunded, Constellation remains owned through the separate active purchase.
- If a fully refunded cosmetic was equipped and no other active purchase still grants it, the account safely falls back to the default Full Tilt loadout.
- Public account data exposes a sanitized purchase history only: product, amount, date, status, refunded amount, and short reference. Stripe customer and PaymentIntent identifiers remain internal.
- The profile drawer shows cosmetic receipts and paid / partial-refund / refunded status.
- Webhook processing and failures write structured Cloudflare Worker logs with Stripe event IDs and event types.

### Public policy + support
- `/terms.html`
- `/purchases.html`
- `/refunds.html`
- `/privacy.html`
- `/contact.html`
- Billing/refund/account support: `fckthefees@gmail.com`

Full Tilt uses play chips only. It does not provide real-money wagering, cash-out, purchased playable chips, or monetary prizes. Paid items are cosmetic only and provide no gameplay advantage.

## Cloudflare architecture

`TABLES` → `PokerTable` Durable Objects  
`TOURNAMENTS` → `TournamentCoordinator` Durable Objects  
`TOURNAMENT_CHATS` → `TournamentChat` Durable Objects  
`ACCOUNTS` → `PlayerAccount` Durable Objects  
`ASSETS` → built Vite frontend

All `/api/*` requests are routed through the Worker before SPA asset fallback. Wrangler migrations contain all Durable Object classes; do not remove or rename existing migration entries on a deployed environment.

## Discord configuration

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

Current workers.dev callback:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/auth/callback
```

## Stripe configuration

Required Worker secrets:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Sandbox uses `sk_test_...` plus the sandbox webhook destination’s `whsec_...` signing secret. No publishable key is required because Full Tilt redirects to Stripe-hosted Checkout.

Webhook endpoint:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/shop/webhook
```

Subscribe the Stripe webhook destination to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
```

Sandbox product and price IDs are stored as non-secret Wrangler vars.

Before live mode:
1. Create/confirm live-mode Stripe Products and Prices.
2. Replace sandbox price/product vars with live IDs.
3. Replace `STRIPE_SECRET_KEY` with `sk_live_...`.
4. Create a separate live webhook destination and install its live `whsec_...` as `STRIPE_WEBHOOK_SECRET`.
5. Subscribe the live destination to the three events above.
6. Set `STRIPE_MODE=live`.
7. Run one controlled low-cost live transaction and verify purchase, equip, purchase history, and refund behavior before opening the shop broadly.

## Verification

Every push to `main` runs GitHub Actions on Node 22:

```bash
npm install
npm run audit:prod
npm run audit:all
npm test
npm run build
npm run check:worker
```

`npm run check:worker` performs a Wrangler deployment dry-run. It validates the Worker and bindings but does not publish to Cloudflare.

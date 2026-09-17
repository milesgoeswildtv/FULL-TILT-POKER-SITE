# Crashout Poker — Telegram Mini App

Crashout Poker's Telegram client is the same React application and authoritative Cloudflare/Durable Object poker backend used by the website. Telegram does not run a separate poker engine, player pool, tournament coordinator, chip ledger, account inventory, or cosmetic entitlement system.

## Current behavior

- Website players authenticate with Discord OAuth.
- Telegram Mini App players authenticate from signed `Telegram.WebApp.initData`.
- Telegram launch data is validated server-side before a normal Crashout account session is issued.
- Discord and Telegram identities can be explicitly linked into one canonical Crashout Poker account.
- Telegram and website users share the same tables, tournaments, lifetime stats, owned cosmetics, and equipped loadout.
- Telegram bot notifications support tournament starts, table moves, tournament results, hosted-table events, and optional turn reminders.
- Telegram Mini App purchases use Telegram Stars (`XTR`); website purchases continue to use Stripe.
- Successful Stars payments and Stripe payments both grant the same canonical account entitlements.

## Telegram setup

Use BotFather to create/select the Crashout Poker bot and configure its Main Mini App (or named Mini App) to the deployed site.

Production URL example:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/
```

Telegram's official Mini App bridge is loaded by `index.html` before React.

## Cloudflare configuration

Never commit bot/payment secrets to GitHub.

Set these as Worker secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

`TELEGRAM_WEBHOOK_SECRET` must be 1–256 characters using only `A-Z`, `a-z`, `0-9`, `_`, and `-`, because Telegram sends it back in the `X-Telegram-Bot-Api-Secret-Token` webhook header.

Set these non-secret Worker variables:

```text
TELEGRAM_BOT_USERNAME=<bot username without @>
TELEGRAM_APP_SHORT_NAME=<optional named Mini App short name>
TELEGRAM_INITDATA_MAX_AGE=900

TELEGRAM_STARS_CONSTELLATION=<positive integer Star price>
TELEGRAM_STARS_DEAD_MANS_HAND=<positive integer Star price>
TELEGRAM_STARS_REGALIA=<positive integer Star price>
TELEGRAM_STARS_TRIPLE_THREAT=<positive integer Star price>
```

No Stars product is purchasable until its Star price is configured. The Stars catalog also remains disabled until both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are present.

## Telegram Stars webhook

After deployment, register this HTTPS endpoint with the poker bot:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/telegram/webhook
```

Example Bot API request:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://full-tilt-poker-site.milesgoeswildtv.workers.dev/api/telegram/webhook",
    "secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates":["message","pre_checkout_query"]
  }'
```

Use the same secret value stored in Cloudflare. Do not paste the bot token into chat, source code, issue comments, or frontend configuration.

The webhook handles:

- `pre_checkout_query`: validates the pending Crashout order, Telegram buyer, currency, Star amount, ownership, and expiry before approving checkout.
- `message.successful_payment`: records the Telegram payment charge and grants the cosmetic entitlement exactly once.
- `/paysupport`: returns the Crashout Poker payment-support route.

## Stars purchase flow

1. A verified Telegram Mini App user opens Booster Shop.
2. The Worker creates a pending Stars order on the canonical PlayerAccount.
3. The Worker calls Telegram `createInvoiceLink` with currency `XTR`.
4. The Mini App opens the returned invoice using `Telegram.WebApp.openInvoice()`.
5. Telegram sends `pre_checkout_query` to the verified webhook.
6. Crashout validates the server-side pending order and answers the query.
7. Telegram sends `successful_payment`.
8. Only the webhook grants the purchase to the canonical account.
9. The Mini App refreshes `/api/auth/me` until the entitlement appears, then shows the normal unlock reveal.
10. A Stars refund uses Telegram `refundStarPayment` and removes entitlements that are no longer supported by another active purchase.

The browser never grants purchases based on `invoiceClosed`; that event is only used to drive UI state.

## Direct game links

Crashout encodes only the game type and six-character public game code in Telegram `startapp` parameters. Private session bearer tokens are never placed in Telegram invite links.

Main Mini App:

```text
https://t.me/<bot_username>?startapp=table_FT7K2Q
https://t.me/<bot_username>?startapp=tournament_ABC123
```

Named Mini App:

```text
https://t.me/<bot_username>/<app_short_name>?startapp=table_FT7K2Q
https://t.me/<bot_username>/<app_short_name>?startapp=tournament_ABC123
```

## Authentication contract

The browser sends raw `Telegram.WebApp.initData` to:

```text
POST /api/auth/telegram
```

The Worker validates Telegram's signed launch data, rejects stale/malformed identities, maps the user to `telegram:<id>`, resolves any canonical Discord link, synchronizes the standard PlayerAccount, and issues the same signed HttpOnly Secure Crashout account cookie used by the website.

The application never trusts `Telegram.WebApp.initDataUnsafe` as authentication evidence.

## Pre-release verification

Before enabling Stars publicly:

1. Set the bot token, webhook secret, bot username, and four Stars price variables.
2. Deploy the exact tested `main` commit.
3. Register `/api/telegram/webhook` with `setWebhook`.
4. Open `/api/shop/stars/catalog` and verify `configured: true` and the expected XTR prices.
5. In Telegram, purchase one booster and confirm the native Stars invoice opens.
6. Confirm pre-checkout succeeds and the cosmetic appears only after `successful_payment`.
7. Reload both Telegram and website clients and verify the same canonical inventory.
8. Replay the payment update in tests and verify no duplicate entitlement/purchase is created.
9. Process a Stars refund and verify the cosmetic is removed unless another active purchase still grants it.
10. Send `/paysupport` to the bot and confirm the support response.
11. Re-run Poker CI on the exact release commit.

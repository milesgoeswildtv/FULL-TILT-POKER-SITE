# Full Tilt Poker — Telegram Mini App

Full Tilt's Telegram client is the same React application and the same authoritative poker backend used by the website. Telegram does not run a separate poker engine, player pool, tournament coordinator, or chip ledger.

## Phase 1 behavior

- Website players authenticate with Discord OAuth.
- Telegram Mini App players authenticate from signed `Telegram.WebApp.initData`.
- The Worker validates Telegram launch data before creating a normal Full Tilt `ftp_account` session.
- Telegram accounts use namespaced IDs (`telegram:<telegram_user_id>`) so they cannot collide with existing Discord IDs.
- Telegram and website users create, join, spectate, and play the same tables and MTTs.
- Existing owned cosmetics can be equipped in Telegram.
- Stripe checkout and purchase history are intentionally not exposed inside Telegram. Add Telegram Stars before selling digital cosmetics inside the Mini App.
- Discord↔Telegram account linking is not part of Phase 1. A Discord identity and a Telegram identity are separate Full Tilt account records until an explicit linking flow is added.

## Telegram setup

Use BotFather to create or select the Full Tilt bot, then configure a Main Mini App (or a named Mini App) whose URL is the deployed Full Tilt site.

Production URL example:

```text
https://full-tilt-poker-site.milesgoeswildtv.workers.dev/
```

Telegram's official Mini App bridge is already loaded by `index.html` before React.

## Cloudflare configuration

Never commit the bot token to GitHub.

Set this as a Worker secret:

```text
TELEGRAM_BOT_TOKEN
```

For example, with Wrangler from an authenticated local shell:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Set these non-secret Worker variables in Cloudflare or Wrangler configuration:

```text
TELEGRAM_BOT_USERNAME=<bot username without @>
TELEGRAM_APP_SHORT_NAME=<optional named Mini App short name>
TELEGRAM_INITDATA_MAX_AGE=900
```

`TELEGRAM_APP_SHORT_NAME` may be left unset for the bot's Main Mini App. `TELEGRAM_INITDATA_MAX_AGE` is optional; Full Tilt defaults to 900 seconds and clamps configuration to 60–3600 seconds.

## Direct game links

Full Tilt encodes only the game type and six-character public game code in Telegram `startapp` parameters. Private table/session bearer tokens are never placed in Telegram invite links.

Main Mini App examples:

```text
https://t.me/<bot_username>?startapp=table_FT7K2Q
https://t.me/<bot_username>?startapp=tournament_ABC123
```

Named Mini App examples:

```text
https://t.me/<bot_username>/<app_short_name>?startapp=table_FT7K2Q
https://t.me/<bot_username>/<app_short_name>?startapp=tournament_ABC123
```

After Telegram signs the launch, Full Tilt validates the returned `start_param` server-side as part of `initData`, creates the account session, and routes the existing React app to that table/tournament invite.

## Authentication contract

The browser sends the raw `Telegram.WebApp.initData` string to:

```text
POST /api/auth/telegram
```

The Worker:

1. rejects missing/duplicate launch fields;
2. requires a valid `auth_date` within the configured freshness window;
3. builds Telegram's alphabetically sorted data-check string;
4. derives the Web App HMAC secret from `TELEGRAM_BOT_TOKEN` and `WebAppData`;
5. verifies the Telegram `hash` using Web Crypto;
6. rejects bot/malformed user identities;
7. maps the verified user to `telegram:<id>`;
8. syncs the standard `PlayerAccount` Durable Object;
9. issues the same signed, HttpOnly, Secure Full Tilt account cookie used by the website.

The application never trusts `Telegram.WebApp.initDataUnsafe` as authentication evidence.

## Client integration

`src/platform.js` owns Telegram-specific behavior:

- startup authentication before React renders;
- Main Mini App `startapp` routing;
- Telegram safe-area CSS variables;
- native Back button behavior;
- Mini App expand/ready calls;
- Telegram game-link construction and invite sharing.

Poker components do not contain Telegram-specific game rules.

## Pre-release verification

Before enabling the bot publicly:

1. Configure the bot/Mini App URL in BotFather.
2. Set the Worker bot-token secret and bot username variable.
3. Open the Mini App from Telegram on iOS, Android, and Desktop.
4. Confirm the Telegram profile appears without Discord OAuth.
5. Create a quick table from Telegram and join it from the website.
6. Create a table from the website and join it from Telegram using `startapp`.
7. Run a complete hand in each direction and verify reconnect behavior.
8. Run an MTT with a mix of Telegram and website identities and force at least one table move.
9. Confirm Telegram cannot open Stripe checkout from inside the Mini App.
10. Re-run Poker CI on the exact release commit.

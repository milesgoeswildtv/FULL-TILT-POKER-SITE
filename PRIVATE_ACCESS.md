# Crashout Poker Private Access

Crashout Poker is invite-only. Public accounts do not receive game creation or game access merely by logging in.

## Access types

### One-time host key
- The key is redeemed against one Crashout Poker account.
- The first successful account redemption permanently binds the key to that account.
- The key grants exactly one game creation credit.
- The credit may create either one Quick Table or one Multi-Table Tournament.
- Failed game creation releases the reserved credit.
- Re-entering the same key on the same account is idempotent and never grants another credit.
- Re-entering that key on a different account is rejected.

### Permanent host key
- The first successful account redemption permanently binds the key to that account.
- The account may create unlimited private tables and tournaments.
- Sharing the raw key after redemption does not grant another account access.

### Invite code
- The existing six-character table or tournament code is the private invite code.
- A player who knows the code may link that specific game to their authenticated Crashout account.
- Invite access never grants game-creation permission.
- Spectating is protected by the same invite requirement.

## Deployment requirement

Set a high-entropy Cloudflare Worker secret named:

    ACCESS_ADMIN_SECRET

Do not put this value in the repository or frontend.

## Generate keys

Authenticated admin request:

    POST /api/access/admin/keys
    Authorization: Bearer <ACCESS_ADMIN_SECRET>
    Content-Type: application/json

One-time keys:

    {"type":"one-time","count":10}

Permanent keys:

    {"type":"permanent","count":1}

The response contains the plaintext keys. Save or distribute them at issuance time. The access registry stores only the hashed key lookup and binding metadata; the plaintext key is not retrievable later.

## List key status

    GET /api/access/admin/keys
    Authorization: Bearer <ACCESS_ADMIN_SECRET>

The list shows key id, type, creation time, whether the key is unused, bound, or revoked, and the bound account id for claimed keys. It does not return plaintext keys.

## Revoke an unused key

    POST /api/access/admin/revoke-key
    Authorization: Bearer <ACCESS_ADMIN_SECRET>
    Content-Type: application/json

    {"id":"<key-id>"}

## Revoke host privileges from an account

    POST /api/access/admin/revoke-host
    Authorization: Bearer <ACCESS_ADMIN_SECRET>
    Content-Type: application/json

    {"accountId":"<canonical-account-id>"}

This removes permanent-host status, unused host credits, and outstanding host reservations. It does not delete the player's account, stats, cosmetics, or private-game invitations.

## Account linking

If a Telegram identity is linked into its Discord canonical account, private host credits, permanent-host status, invitations, and key-grant history migrate with the account. Bound host-key records are re-bound to the canonical account so the same key continues to identify the same person after linking.

## Server enforcement

The frontend does not provide the security boundary.

The Worker rejects:
- table or tournament creation without host entitlement;
- access to a specific game without an invite grant;
- joining or spectating a game without that game's invite grant;
- use of a host key by an account other than the account to which it was first bound.

Website and Telegram Mini App use the same backend enforcement.

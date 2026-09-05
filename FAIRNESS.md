# FULL TILT POKER — FAIRNESS CONTRACT

Full Tilt Poker does not weight, boost, nerf, target, protect, or favor any player when cards are generated.

## Every hand starts with a fresh deck

A brand-new canonical 52-card deck is created before every hand. Cards and discards are never carried from one hand into the next.

Normal Texas Hold'em burn-card behavior is used inside the hand: one burn before the flop, one before the turn, and one before the river. Burn cards are tracked privately by the server so all 52 cards remain accounted for.

## Shuffle algorithm

The server shuffles the fresh deck with Fisher-Yates using Cloudflare Workers `crypto.getRandomValues()` as the cryptographically secure random source.

Random indexes use rejection sampling rather than simple modulo reduction. This removes modulo bias when mapping 32-bit random values into ranges such as 0–51, 0–50, etc.

The shuffle function receives only the canonical ranks and suits. It does not receive player identity, seat history, chip count, previous results, current winning/losing streaks, hole-card strength, host status, or any other player-specific information.

## Dealer position

The initial dealer position is selected with the same cryptographically secure unbiased integer generator. After that, the dealer button rotates through active seats according to the game rules.

## Backend deck accounting

For every new-format hand, the Durable Object verifies that exactly 52 valid unique cards are accounted for across:

- undealt deck
- all players' hole cards
- community board
- burn cards

A missing card, duplicate card, invalid card, or impossible 52-card count throws a deck-integrity error instead of allowing the hand to continue silently.

## Hand commitment

Each shuffled hand receives a SHA-256 commitment to the shuffled draw order before dealing. The commitment is safe to expose while the hand is running because it does not reveal the cards.

The complete hidden deck is deliberately not published after each hand because doing so would reveal folded players' mucked hole cards. The commitment is retained as audit metadata while poker privacy is preserved.

## What the server cannot do by design

There is no code path in the shuffle that asks who should win, who is hosting, who is short-stacked, who recently lost, or what cards would create a dramatic result. The deck is completed before the hand is dealt and is consumed from that fixed shuffled order.

## Tests

`npm test` includes automated checks for shuffle/deck integrity as well as poker hand evaluation. GitHub CI runs tests and a production build on pushes and pull requests.

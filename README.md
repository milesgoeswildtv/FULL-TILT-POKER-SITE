# FULL TILT POKER SITE

Private play-chip No-Limit Texas Hold’em tournament site for the Full Tilt community.

## v0.2 build
- Cloudflare Worker + static React/Vite frontend
- Durable Object per private table
- 2–9 players
- Host-selectable starting chips (presets + custom)
- Timer-based blind levels (presets + custom)
- Private 6-character table codes
- Server-authoritative shuffled deck; deck is never exposed to clients
- Fold / check / call / raise / all-in flow
- True contribution-based main pots and side pots for unequal all-ins
- Community cards and showdown hand evaluation
- Automatic board runout when remaining players are all-in
- Heads-up blind handling
- Host start / pause / resume / pre-game kick / end controls
- Session token persistence for reload/reconnect
- Elimination at zero chips and last-stack-standing tournament finish
- Responsive desktop/mobile poker table UI

This site uses play chips only. Any arrangements outside the game are outside the application.
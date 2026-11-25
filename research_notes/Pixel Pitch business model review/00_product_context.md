# Product context: Pixel Pitch (from the codebase, not web research)

Source: the repository itself (docs/games.md, apps/pixel-pitch/core/src/config.ts), read 2026-11-25. Treat as ground truth about the product.

## What it is
- Pixel-art, portrait, casual football (soccer) card-collection + idle club game. Pre-launch (playtest stage; all economy numbers are marked placeholders).
- Loop: open packs of players (3 per pack, shelf refills one every 45 min, cap 10) -> sign/sell players -> pick a 5-a-side lineup + formation (5 formations with rock-paper-scissors edges) -> auto-simulated league matches every 3 hours with a text match report -> idle stadium coin income (8h cap) -> three 15-30 second arcade mini-games (Kick Timer, Keepy-Uppy, Penalty Shootout) on an energy bar (5, +1 per 90 min) -> daily goals, 7-day login calendar, album sets (+1% team power each), 28-day "League Pass" season (30 tiers, free + premium track).
- Currencies: coins (soft), gems (hard), arcade tokens (buy arcade packs).
- No real players, clubs or leagues: four fictional nations, invented names. No licence costs, no licence appeal.
- No sign-in wall: guest account on first launch, optional cloud save.

## Monetisation as built / planned
- Premium League Pass (28-day season): bigger shelf (16 vs 10), longer idle caps (12h vs 8h), +1 energy, 35 vs 15 daily gems, premium reward track. Price not yet set.
- Gems (hard currency) presumably sold as IAP packs; spent on extra arcade plays (20 gems). Prices not yet set.
- Buying random packs directly with gems is built but switched OFF at launch ("a paid random item") - i.e. the developer is deliberately avoiding paid loot boxes for now. Packs are otherwise earned by time, coins or tokens.
- No ads SDK in the codebase today (no rewarded video).
- A purchases collection and server-side purchase handling exist; purchases go through RevenueCat (wrapping Apple StoreKit / Google Play Billing).

## How it is built
- One TypeScript/React codebase (Vite, DaisyUI/Tailwind), wrapped with Capacitor for iOS and Android, also runs as an offline-capable PWA on the web. Canvas-based mini-games with a small in-house game kit.
- Backend: Payload CMS + Better Auth on Postgres, deployed to Vercel. Server-authoritative: server owns the clock, rolls packs, replays mini-game taps to stop cheating. Game economy config is an admin-editable global (tune without app release).
- Monorepo (pnpm + Turborepo) designed as a multi-app factory: shared packages (UI, native wrappers, backend factory, game kit, api client, telemetry) + `pnpm create:app` template + a "new app playbook". Game rules for each game live in a pure `core` package. So a re-themed sibling game (another sport) reuses most infrastructure; it needs new rules/config, art, copy, catalogue and store listing.
- Developer: a UK-based solo developer / very small studio (Lewis Digital). Assume little or no paid user-acquisition budget unless the economics justify it.

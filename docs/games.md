# Games

A game is an app with a `core` package and a server that owns the clock.

## `core`: the rules

Pure functions of `(state, config, now, seed)`. No React, Capacitor, Payload, `Math.random` or `Date.now` (the architecture check enforces it). Randomness comes from `@ld/utils/random/rng` (`createRng(seed)`, `fork`, `poisson`): the same seed gives the same result on every device and on the server.

The app imports `core` to **preview** (a lineup score, a win chance, an "upgrade" badge). The api imports it to **decide**. Because it is the same code, the numbers always agree.

Every number lives in a config object validated by a schema, edited in the admin as a global, and stamped on results. Tuning needs no app release.

## Time

The server owns every clock. Store timestamps (`lastCollectedAt`), not counters. On every open and resume the client calls `/game/sync`, and the server computes what happened while away from its own clock. Changing the phone's clock does nothing.

The key property to test: `advance(advance(s, t1), t2)` equals `advance(s, t2)`. The game pays the same whether the player checks in every five minutes or once a day.

Tests and playtesters can skip time with the `X-Debug-Now` header, honoured only when `ALLOW_TIME_TRAVEL=1` (refused in production). In mock data mode the app runs the rules in the browser on a clock Playwright moves with `window.__pixelPitchClock.advance(ms)`.

## Rewards and cheating

A reward endpoint is a `defineAction`. The client sends what it did; the server recomputes the outcome from the seed and clamps the reward to what was possible. A mini-game gets a single-use ticket with a seed and a maximum payout; `finish` checks elapsed time and score against it.

## Pixel Pitch's systems

Everything below is a pure function in `apps/pixel-pitch/core`, run by the api (the real outcome) and by the app's mock mode (development, Playwright, Lighthouse), so the two cannot disagree.

| System | Where | How it is kept honest |
| --- | --- | --- |
| Packs | `flow-packs.ts` | A roll is seeded by the club and how many packs it has opened, never by the client. A Star or better is guaranteed within 40 players. The bench holds 20, coin packs are 3 a day. A pack is held as `pendingPack` until each player is signed or sold. |
| Stadium, trays | `flow-stadium.ts`, `flow-arcade.ts` | A pile is derived from a timestamp (`stadiumCollectedAt`), never stored as a counter; collecting moves the timestamp. |
| Arcade games, warm-up | `minigames.ts`, `flow-arcade.ts` | The server issues a ticket with a seed and the time. The phone sends only its taps; the server replays them with that seed (the game is a pure function of both) and checks its own clock ran at least as long as the taps say. Tickets are single use. Taps closer than 120 ms are refused, and Keepy-Uppy locks the player out for half a second after a mistimed tap, so mashing does not work. |
| Goals, calendar | `flow-rewards.ts`, `progress.ts` | The day's goals are drawn from the club id and the date. Progress is counted as things happen (a win only counts on the day it was played). A claim is checked against the state, never against what the phone says. |
| League Pass | `flow-rewards.ts` | 28-day seasons from a fixed date (so every player is in the same season). XP from matches, packs, arcade plays and goals. A late Pass unlocks every tier already reached. |
| Album | `album.ts` | Sets are dealt from the catalogue (each nation's players of each position, best first, dealt like cards into sets of six, so every set mixes top and bottom). Each finished set is +1% team power, applied in `scoreLineup`, so it is in the preview and the match alike. |
| Match report | `commentary.ts` | Only colour is invented. The goals, saves and misses are the match's own events, so the report always agrees with the score. |

A club's state (`ClubState`) is JSON in the `clubs` collection. A saved club from an earlier version gains any new field through `upgradeState`, so adding to the state never needs a data migration.

### Numbers that are placeholders

Every number is in the game config (an admin-editable global), so these can be tuned after a playtest without an app release. The ones that are guesses and not in the MVP spec: stadium curve and upgrade costs; token tray rate (12 an hour) and tokens a play (up to 60); gems for an extra play (20) and what it pays (300 coins); the Kick Timer and Keepy-Uppy tuning (speeds, zone widths, gravity, ramp, reach); the warm-up zone widths; the goal pool and its rewards; the calendar and Pass rewards; XP for each source (match 8, win +4, pack 5, arcade 8, goal 25); the tactical-edge table; rival strength; training caps and costs; win and draw coins; the middle rows of the pack odds table.

Two to look at first in a playtest: Keepy-Uppy is a steep skill curve (a player who reacts to the zone opening, rather than anticipating the ball, gets almost no kicks), and the Pass pacing. XP is set so a player who does everything every day (8 matches, 9 packs, 6 arcade plays, 3 goals: about 100 XP a day) just fills the 3,000-XP track in a 28-day season, and a casual player reaches about tier 16. Change `pass.xp` or `pass.xpPerTier` if playtesters finish early or never get past the first week.

## Game kit (`@ld/game`)

- Atlas loader for TexturePacker "hash" JSON, `Sprite` and `AnimatedSprite` (whole-number scaling, `image-rendering: pixelated`).
- Key-colour recolouring: `#ff0000` becomes the club's primary and `#00ff00` the secondary (`swapColours`). Cache the result.
- `createFixedStep` and `useCanvasLoop`: fixed-step logic, optional fps cap, stops while the page is hidden.
- `createAudioManager`: separate music and effects switches, mutes music in the background, unlocks on the first tap.
- `useReducedEffects` (`@ld/react-utils`): low-effects mode for weak devices and reduced-motion users. One class on the root; every feature still works.

## Formations and the match (Pixel Pitch)

The spec's `xG = 1.35 × (ATT ÷ their DEF)²`, with ATT divided by 2 and DEF by 3, could not produce counter-picks. A ratio squared makes a side's strength one number, ATT × DEF. Every role's weights add up to 1, so that product is highest for the most balanced formation: Blitz was the best reply to everything and Wall was never worth picking. The rule now is:

- `ATT = Σ(slot × att weight) ÷ 2.5` and `DEF = Σ(slot × def weight) ÷ 2.5`, both × (1 + chemistry). ATT + DEF is always twice the lineup score, so a formation moves strength between attack and defence and never adds any.
- `xG = baseXg × 2^((ATT − their DEF) ÷ doublingGap)`, capped at `maxXg` (defaults 2.4, 20, 8). The gap counts, not the ratio. Two Boxes of equal players expect the spec's 1.35 goals each.
- A tactical-edge table (`formations.edges` in the config) gives one formation a few rating points over another: added to its ATT and DEF and taken off the other side's. The defaults are placeholders: two cycles (Wall > Blitz > Diamond > Wall by 5; Diamond > Box > Pyramid > Blitz by 2) and 1-point edges for the other pairs.

Five 70-rated players a side (win % for the row against the column):

| | Box | Diamond | Pyramid | Wall | Blitz | Average points | Goals each, mirror | Best reply to it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Box (2-2) | 37 | 29 | 41 | 33 | 34 | 1.99 | 1.34 | Diamond |
| Diamond (1-2-1) | 45 | 35 | 30 | 44 | 18 | 1.98 | 1.10 | Blitz |
| Pyramid (2-1-1) | 27 | 36 | 29 | 24 | 45 | 2.01 | 0.62 | Box |
| Wall (3-1) | 28 | 18 | 28 | 22 | 52 | 2.01 | 0.34 | Diamond |
| Blitz (1-1-2) | 44 | 63 | 29 | 19 | 41 | 2.01 | 2.40 | Wall |

Every formation averages 2 points against the field, and the best reply changes with the rival's formation. Without any edge, defending pays against a stronger side (against a +7 rival: Wall 1.84 points, Blitz 1.71) and attacking pays against a weaker one (against −7: Blitz 2.31, Wall 2.19). `bestFormation(squad, rival)` ranks the five for the squad screen's hint. `tests/match.spec.ts` checks the balance, the counter-picks and the stronger/weaker rule, so a config change that breaks them fails CI.

## Art

Source in `apps/<slug>/art`. Scale by whole numbers only. Fonts must be bundled (never loaded from a CDN).

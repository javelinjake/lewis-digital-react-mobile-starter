# Games

A game is an app with a `core` package and a server that owns the clock.

## `core`: the rules

Pure functions of `(state, config, now, seed)`. No React, Capacitor, Payload, `Math.random` or `Date.now` (the architecture check enforces it). Randomness comes from `@ld/utils/random/rng` (`createRng(seed)`, `fork`, `poisson`): the same seed gives the same result on every device and on the server.

The app imports `core` to **preview** (a lineup score, a win chance, an "upgrade" badge). The api imports it to **decide**. Because it is the same code, the numbers always agree.

Every number lives in a config object validated by a schema, edited in the admin as a global, and stamped on results. Tuning needs no app release.

## Time

The server owns every clock. Store timestamps (`lastCollectedAt`), not counters. On every open and resume the client calls `/game/sync`, and the server computes what happened while away from its own clock. Changing the phone's clock does nothing.

The key property to test: `advance(advance(s, t1), t2)` equals `advance(s, t2)`. The game pays the same whether the player checks in every five minutes or once a day.

Tests and playtesters can skip time with the `X-Debug-Now` header, honoured only when `ALLOW_TIME_TRAVEL=1` (refused in production).

## Rewards and cheating

A reward endpoint is a `defineAction`. The client sends what it did; the server recomputes the outcome from the seed and clamps the reward to what was possible. A mini-game gets a single-use ticket with a seed and a maximum payout; `finish` checks elapsed time and score against it.

## Game kit (`@ld/game`)

- Atlas loader for TexturePacker "hash" JSON, `Sprite` and `AnimatedSprite` (whole-number scaling, `image-rendering: pixelated`).
- Key-colour recolouring: `#ff0000` becomes the club's primary and `#00ff00` the secondary (`swapColours`). Cache the result.
- `createFixedStep` and `useCanvasLoop`: fixed-step logic, optional fps cap, stops while the page is hidden.
- `createAudioManager`: separate music and effects switches, mutes music in the background, unlocks on the first tap.
- `useReducedEffects` (`@ld/react-utils`): low-effects mode for weak devices and reduced-motion users. One class on the root; every feature still works.

## Open design issue: formation balance (Pixel Pitch)

With the spec's normalisation (ATT = sum of attack / 2, DEF = sum of defence / 3), the formations have different totals for the same five players. Five 70-rated players give Blitz 146, Box and Diamond 142, Pyramid 138 and Wall 135. Blitz is therefore the best reply to almost every opponent and Wall is never the best. The "counter-pick" the spec promises for League 3 does not emerge: formation moves win probability by only 1 to 2 points once totals are equalised.

Options: keep the spec as written; scale each formation so totals match; or change the model so a formation rewards specialisation (for example opposing ATT against DEF by zone). The pending `it.todo('has a counter-pick ...')` in `apps/pixel-pitch/core/tests/match.spec.ts` should become a real test once a rule is chosen.

## Art

Source in `apps/<slug>/art`. Scale by whole numbers only. Fonts must be bundled (never loaded from a CDN).

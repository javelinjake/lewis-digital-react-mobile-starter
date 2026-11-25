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
| Stadium, tray | `flow-stadium.ts`, `flow-arcade.ts` | A pile is derived from a timestamp (`stadiumCollectedAt`, `trayCollectedAt`), never stored as a counter; collecting moves the timestamp. The arcade has one tray, not one per game. |
| Arcade energy | `energy.ts` | One bar for every game: 5 (6 with the Pass), one point back every 90 minutes. Only the time the bar is full again is stored (`energy.fullAt`), never a counter, so it refills on the server's clock whether or not anyone is looking and the Pass raises the ceiling at once. A play costs 1. With none left, 20 gems buy a play that pays coins and Pass XP, never tokens. |
| Arcade games, warm-up | `minigames.ts`, `flow-arcade.ts` | Three games (Kick Timer, Keepy-Uppy, Penalty Shootout), each about 15 to 30 seconds. The server issues a ticket with a seed and the time. The phone sends only its taps; the server replays them with that seed (the game is a pure function of both) and checks its own clock ran at least as long as the taps say. Tickets are single use. Taps closer than 120 ms are refused, and Keepy-Uppy locks the player out for half a second after a mistimed tap, so mashing does not work. A best score is kept for each game, and one game a day (taking turns) pays +50% tokens. |
| Claim all | `flow-claim-all.ts` | `waitingToClaim` says what is waiting (stadium, tray, calendar day, free pack, goals, Pass tiers, album sets) and `claimAll` takes all of it by running the individual claims one after another in one transaction, so the Ready now list and the claim cannot disagree. `/game/claim-all`. |
| Goals, calendar | `flow-rewards.ts`, `progress.ts` | The day's goals are drawn from the club id and the date. Progress is counted as things happen (a win only counts on the day it was played). A claim is checked against the state, never against what the phone says. The calendar is one claim a day; a missed day keeps its place rather than starting again. |
| League Pass | `flow-rewards.ts`, `progress.ts` | 28-day seasons from a fixed date (so every player is in the same season). XP from matches, packs, arcade plays and goals. The Pass is bought for one season (`idle.passSeason`); `hasPass` is worked out from it on every sync, so it ends with the season on the server's clock. A late Pass unlocks every tier already reached. When a season ends, `closeSeason` pays every tier reached but not claimed, so nothing earned is lost. The premium track holds no packs: gems, coins, the season's two kits and two Star Signings. |
| Shop | `flow-shop.ts`, `config-shop.ts` | See "The shop" below. |
| Ladder | `league.ts` | Promotion pays `league.promotionRewards` (50 gems and a Star pack). Past League 1, rivals grow by `rivalPrestigeStep` (2) a tier up to `rivalMaxRating` (95), so Prestige stays winnable with the best cards. |
| Album | `album.ts` | Sets are dealt from the catalogue (each nation's players of each position, best first, dealt like cards into sets of six, so every set mixes top and bottom). Each finished set is +1% team power, applied in `scoreLineup`, so it is in the preview and the match alike. |
| Match report | `commentary.ts`, `commentary-lines.ts` | A few big moments, not every event: the kick-off, every goal, up to six chances in all (a quiet match is topped up to four with saves and misses that change nothing on the scoreboard), a little colour, half-time and full-time. A chance has two beats, what is happening and then what came of it. Fourteen kinds of goal, five of save, seven of miss and ten colour incidents, each with its own lead-ins and finishes, plus a rare own goal. The goals and the score after each are the match's own, so the report always agrees with the result. |

A club's state (`ClubState`) is JSON in the `clubs` collection. A saved club from an earlier version gains any new field through `upgradeState`, so adding to the state never needs a data migration. (The one that changed shape: the two arcade token trays became one, emptied at the earlier of the two times, and the daily plays became energy, starting full.)

### Accounts and devices

There is no sign-in screen. A first launch makes this device its own account (a Better Auth guest, kept in the Keychain or Keystore on native, a cookie on the web) and goes straight to founding a club. The club lives on the server like any other. Settings offers **Save to the cloud** (create an email account; the club moves to it) and **Sign in to the cloud** (play an existing account's club here; the device's club is deleted, because an account has one club). A device-only player cannot sign out, which would lose the club. Signing out of a cloud account starts a fresh device club, with a sign-in link on the New club screen.

### Where things are

Five tabs: Club, Packs, Squad, Arcade and League, each with a count of what is waiting. Settings is a button in the header. The top of the Club screen is **Ready now**: everything that is waiting, one line each (a line goes to the screen that has it), and one button, **Claim all**, that takes all of it and shows what it paid. With nothing ready it says what is coming and when. The end of a match, an arcade play and a claim each offer the next step, the pack opening has **Reveal all** and **open the next pack**, and Welcome back has Claim all.

### Screen sizes

Phones are portrait. On tablets and desktop browsers the whole screen (header, content, tab bar) is a centred column (`MobileShell column`, `max-w-xl`), and on iPad the app rotates, since iPadOS no longer supports portrait-only apps. Android tablets keep the portrait lock below Android 16, which ignores it on large screens; the column handles either.

### Numbers that are placeholders

Every number is in the game config (an admin-editable global), so these can be tuned after a playtest without an app release. The ones that are guesses and not in the MVP spec: stadium curve and upgrade costs; the arcade tray rate (24 an hour, 8 hours) and tokens a play (up to 60); arcade energy (5, 6 with the Pass, one back every 90 minutes) and the +50% for the game of the day; gems for an extra play (20) and what it pays (300 coins); the Kick Timer, Keepy-Uppy and Penalty Shootout tuning (speeds, zone widths, twists, gravity, ramp, reach, the keeper's reach); the match report (six chances at most, four at least, two colour moments, and the reading time for each beat); the warm-up zone widths; the goal pool and its rewards; the calendar and Pass rewards; XP for each source (match 2, win +1, pack 2, arcade play 3, goal 20); the tactical-edge table; rival strength; training caps and costs; win and draw coins; the middle rows of the pack odds table.

Three to look at first in a playtest: the arcade energy (is five plays and 90 minutes a point back too tight or too loose?), Keepy-Uppy's difficulty (a play lasts 30 seconds at most; a player who reacts to the zone opening rather than anticipating the ball gets about 12 kicks, a quick one about 30), and the Pass pacing. XP is set so a player who does everything every day (8 matches, 9 packs, 6 arcade plays, 3 goals: about 100 XP a day) just fills the 3,000-XP track in a 28-day season, and a casual player reaches about tier 16. Change `pass.xp` or `pass.xpPerTier` if playtesters finish early or never get past the first week. `flow-rewards.spec.ts` checks the pacing: a do-everything day (about 116 XP) fills the track, and a casual player passes the first Star Signing at tier 15. (With goals at 15 XP the full track was out of reach even doing everything, which is why goals pay 20.)

## The shop

The rule: pay for time, choice and looks, never for a mystery. Random packs are only ever earned by playing. No product, and no premium Pass tier, pays a pack, and gems never buy one (`advance.spec.ts` checks this). That keeps the game out of the paid-random-item rules (PEGI 16 for new submissions since June 2026, odds disclosure, Belgium).

| Product (store id) | Price | What it pays |
| --- | --- | --- |
| Starter offer (`pp_starter`) | £1.99 | Once, in the first 72 hours: a Star Signing, 300 gems, 5,000 coins. The hub shows it after the first league match. |
| League Pass (`pp_league_pass`) | £3.99 | This season's Pass. A second one in the same season pays 500 gems instead. |
| Chairman's Licence (`pp_chairman_licence`) | £2.99 | For good: +5 bench, free kit and crest changes. |
| Gems (`pp_gems_80`, `_500`, `_1100`, `_2400`) | £0.99 to £19.99 | 80, 500, 1,100, 2,400 gems. |

Every product is a one-off (consumable or non-consumable) purchase; none renews. The store's price is shown in the app; `price` in the config is only for the web and the playtest build.

Gems buy: an extra arcade play (20), a full energy refill (50), +5 bench (100, up to three times), a second warm-up kick (10), a kit or crest change (50, free with the Licence) and premium kits (150 to 300). A free player gets about 20 gems a day.

A **Star Signing** offers three named Star players, seeded by the club and how many it has taken (`signingOffer`), so the offer is shown before buying and never re-rolled. The player picks one (`/game/signing`).

**How a purchase is paid.** The app buys through RevenueCat (`@ld/native/purchases`), with the RevenueCat app user id set to the backend user id. RevenueCat calls the webhook (`/api/purchases/revenuecat`), and `grantPurchase` (`api/cms/actions/shop.ts`) pays the product into the club with `applyPurchase`, inside the webhook's transaction, once per event id. An unknown product or a buyer with no club is recorded and not paid. The app syncs until it sees the change. The mock build pays at once (`pretendPurchase`), so the shop works in a playtest.

**Analytics.** `src/lib/telemetry.ts` lists every event (first steps, packs, matches, arcade, shop views, purchases, gem spends). Nothing is sent until the player agrees (a card on the hub, and a switch in Settings), and only when `VITE_POSTHOG_KEY` is set.

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

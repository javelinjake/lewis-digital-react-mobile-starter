/**
 * Pacing simulation: plays clubs through the real rules for weeks of game time and reports how many days each one
 * takes to reach every league. Run it after changing league, pack or economy numbers:
 *
 *   pnpm --filter @ld/pixel-pitch-core pacing [days] [clubs]
 *
 * Each profile is a way of playing. They all open every pack, sign the useful players and sell the rest, merge
 * copies, field the best lineup, upgrade the stadium and train the lineup with spare coins. What differs is how often
 * they look in and what skill they bring (warm-ups, Big Chances, live moments).
 */
import type { ClubState, FlowContext, FlowResult, GameConfig, OwnedCard, Player, PoolPlayer } from '../src'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { autoPick, benchHasRoom, buyPack, cardRating, claimAll, DEFAULT_CONFIG, decidePack, FOOTBALLERS, foundClub, mergeable, mergeInClub, NEW_CARD_PREFIX, openPack, sellCard, setLineup, syncClub, toFielded, trainingCost, trainInClub, upgradeStadium } from '../src'
import { pacingHooks } from './pacing-hooks'

const HOUR = 60 * 60_000
const DAY = 24 * HOUR

export interface Profile {
  name: string
  /** Hours of the day the player looks in. */
  visits: number[]
  /** Share of warm-ups that come out gold (the rest green). 0 never warms up. */
  warmupGold: number
  /** Share of Big Chances and live moments the player scores. 0 never plays them. */
  skill: number
}

export const PROFILES: Profile[] = [
  { name: 'idle only (2 visits a day, never plays)', visits: [9, 21], warmupGold: 0, skill: 0 },
  { name: 'casual (3 visits, average skill)', visits: [8, 13, 21], warmupGold: 0.3, skill: 0.5 },
  { name: 'engaged and skilled (6 visits)', visits: [7, 10, 13, 16, 19, 22], warmupGold: 0.8, skill: 0.8 },
]

interface Sim {
  state: ClubState
  cards: OwnedCard[]
  nextId: number
}

function makeContext(sim: Sim, config: GameConfig, catalogue: Player[], players: (id: string) => Player | undefined, clubId: number, now: number): FlowContext {
  return { state: sim.state, cards: sim.cards, catalogue, players, config, clubId, now }
}

function apply(sim: Sim, result: Pick<FlowResult<unknown>, 'state' | 'cards'>): Sim {
  if (!result.cards)
    return { ...sim, state: result.state }
  let nextId = sim.nextId
  const ids = new Map<string, string>()
  const cards = result.cards.map((card) => {
    if (!card.id.startsWith(NEW_CARD_PREFIX))
      return card
    const id = String(nextId++)
    ids.set(card.id, id)
    return { ...card, id }
  })
  const state = { ...result.state, lineup: result.state.lineup.map(id => (id ? ids.get(id) ?? id : null)) }
  return { state, cards, nextId }
}

const attempt = <T>(run: () => T): T | null => {
  try {
    return run()
  }
  catch {
    return null
  }
}

export function simulate(profile: Profile, clubId: number, days: number, config: GameConfig = DEFAULT_CONFIG) {
  const catalogue = [...FOOTBALLERS]
  const byId = new Map(catalogue.map(player => [player.id, player]))
  const players = (id: string) => byId.get(id)
  const start = Date.UTC(2026, 0, 5, 8)
  const rng = createRng(hashSeed('pacing', profile.name, clubId))
  const founded = foundClub({ clubId, now: start, config, catalogue, players })
  let sim: Sim = { state: founded.state, cards: founded.cards, nextId: 1 }
  sim = apply(sim, { state: founded.state, cards: founded.cards })
  const reachedAt: Record<number, number> = { 1: 0 }
  const hooks = pacingHooks(config)

  for (let day = 0; day < days; day++) {
    for (const hour of profile.visits) {
      const now = start - 8 * HOUR + day * DAY + hour * HOUR
      if (now < start)
        continue
      const ctx = () => makeContext(sim, config, catalogue, players, clubId, now)
      const synced = syncClub({ state: sim.state, cards: sim.cards, players, clubId, config, now })
      sim = { ...sim, state: synced.state }
      for (const fixture of synced.fixtures) {
        if (fixture.promotedTo && reachedAt[fixture.promotedTo] === undefined)
          reachedAt[fixture.promotedTo] = (fixture.kickoffAt - start) / DAY
      }
      sim = hooks.afterSync(sim, synced.fixtures, profile, rng, ctx)
      // A Big Chance can promote too.
      for (let tier = 2; tier <= sim.state.league.tier; tier++) {
        if (reachedAt[tier] === undefined)
          reachedAt[tier] = (now - start) / DAY
      }

      const claimed = attempt(() => claimAll(ctx()))
      if (claimed)
        sim = apply(sim, claimed)

      // Packs: shelf, Star packs, then coin packs while there are coins to spare.
      for (let guard = 0; guard < 40; guard++) {
        const source = sim.state.starPacks > 0 ? 'star' : sim.state.idle.shelfPacks > 0 ? 'shelf' : null
        const opened = source ? attempt(() => openPack(ctx(), source)) : (sim.state.coins > config.shelf.extraPackCoins * 2 ? attempt(() => buyPack(ctx())) : null)
        if (!opened)
          break
        sim = apply(sim, opened)
        sim = decide(sim, ctx, config, players)
      }

      for (const group of mergeable(sim.cards, config)) {
        const merged = attempt(() => mergeInClub(sim.state, sim.cards, group.slice(0, config.cards.mergeCopies).map(card => card.id), config))
        if (merged)
          sim = apply(sim, merged)
      }

      const pool: PoolPlayer[] = sim.cards.map(card => ({ id: card.id, ...toFielded(card, players(card.playerId)!, config) }))
      const picked = attempt(() => setLineup(sim.state, sim.state.formation, padLineup(autoPick(sim.state.formation, pool).ids), sim.cards))
      if (picked)
        sim = { ...sim, state: picked }

      const upgraded = attempt(() => upgradeStadium(ctx()))
      if (upgraded)
        sim = apply(sim, upgraded)

      // Train the lineup, cheapest first.
      for (let guard = 0; guard < 30; guard++) {
        const options = sim.state.lineup
          .map(id => sim.cards.find(card => card.id === id))
          .filter((card): card is OwnedCard => card !== undefined)
          .map(card => ({ card, next: trainingCost(card, players(card.playerId)!, config) }))
          .filter(option => 'cost' in option.next && option.next.cost <= sim.state.coins)
          .sort((a, b) => ('cost' in a.next ? a.next.cost : 0) - ('cost' in b.next ? b.next.cost : 0))
        const trained = options[0] ? attempt(() => trainInClub(sim.state, sim.cards, options[0].card.id, players, config)) : null
        if (!trained)
          break
        sim = apply(sim, trained)
      }

      if (profile.warmupGold > 0 && sim.state.warmupTriedFor !== sim.state.league.fixtureNo) {
        const bonus = rng.next() < profile.warmupGold ? config.match.warmupGold : config.match.warmupGreen
        sim = { ...sim, state: { ...sim.state, warmupTriedFor: sim.state.league.fixtureNo, league: { ...sim.state.league, warmupBonus: bonus } } }
      }
    }
  }
  return { reachedAt, tier: sim.state.league.tier, lineup: averageLineup(sim, players, config), cards: sim.cards.length }
}

function padLineup(ids: string[]) {
  return Array.from({ length: 5 }, (_, slot) => ids[slot] ?? null)
}

function averageLineup(sim: Sim, players: (id: string) => Player | undefined, config: GameConfig) {
  const ratings = sim.state.lineup.map(id => sim.cards.find(card => card.id === id)).filter((card): card is OwnedCard => !!card).map(card => cardRating(card, players(card.playerId)!, config))
  return Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(1, ratings.length))
}

/** Signs a player who is better than the worst on the bench or a copy towards a merge; sells the rest. */
function decide(sim: Sim, ctx: () => FlowContext, config: GameConfig, players: (id: string) => Player | undefined): Sim {
  const pending = sim.state.pendingPack
  if (!pending)
    return sim
  const owned = new Set(sim.cards.map(card => card.playerId))
  const rating = (card: OwnedCard) => cardRating(card, players(card.playerId)!, config)
  const bench = () => sim.cards.filter(card => !sim.state.lineup.includes(card.id)).sort((a, b) => rating(a) - rating(b))
  const wanted = pending.playerIds.map((id) => {
    const player = players(id)!
    const worst = bench()[0]
    return owned.has(id) || !worst || player.rating > rating(worst) || benchHasRoom(sim.cards, sim.state.lineup, config, 3)
  })
  // Make room by selling the weakest bench players that are not copies of anyone.
  for (let guard = 0; guard < 3 && !benchHasRoom(sim.cards, sim.state.lineup, config, wanted.filter(Boolean).length); guard++) {
    const counts = new Map<string, number>()
    for (const card of sim.cards)
      counts.set(card.playerId, (counts.get(card.playerId) ?? 0) + 1)
    const victim = bench().find(card => (counts.get(card.playerId) ?? 0) < 2) ?? bench()[0]
    const sold = victim ? attempt(() => sellCard(sim.state, sim.cards, victim.id, players, config)) : null
    if (!sold)
      break
    sim = apply(sim, sold)
  }
  const fits = benchHasRoom(sim.cards, sim.state.lineup, config, wanted.filter(Boolean).length)
  const decisions = wanted.map(want => (want && fits ? 'sign' : 'sell'))
  const decided = attempt(() => decidePack(ctx(), decisions)) ?? attempt(() => decidePack(ctx(), decisions.map(() => 'sell')))
  return decided ? apply(sim, decided) : sim
}

function percentile(values: number[], share: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]
}

/** Merges `patch` into `base`, objects key by key, anything else replaced. */
function merge<T>(base: T, patch: unknown): T {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch) || typeof base !== 'object' || base === null)
    return patch as T
  const out = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(patch))
    out[key] = merge(out[key], value)
  return out as T
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = Number(process.argv[2] ?? 60)
  const clubs = Number(process.argv[3] ?? 12)
  // PACING_CONFIG='{"league":{"rivalStep":9}}' tries numbers without editing the config.
  const config = process.env.PACING_CONFIG ? merge(DEFAULT_CONFIG, JSON.parse(process.env.PACING_CONFIG)) : DEFAULT_CONFIG
  for (const profile of PROFILES) {
    const runs = Array.from({ length: clubs }, (_, index) => simulate(profile, 1000 + index, days, config))
    console.log(`\n${profile.name}: ${clubs} clubs over ${days} days`)
    for (let tier = 2; tier <= 7; tier++) {
      const reached = runs.map(run => run.reachedAt[tier]).filter((value): value is number => value !== undefined)
      const label = tier <= 5 ? `League ${6 - tier}` : `Prestige ${tier - 5}`
      if (reached.length === 0) {
        console.log(`  ${label.padEnd(11)} not reached`)
        continue
      }
      console.log(`  ${label.padEnd(11)} ${String(reached.length).padStart(2)}/${clubs} reach it · median day ${percentile(reached, 0.5).toFixed(1)} (fastest ${percentile(reached, 0).toFixed(1)}, slowest ${percentile(reached, 0.99).toFixed(1)})`)
    }
    console.log(`  lineup average rating at the end: ${Math.round(runs.reduce((sum, run) => sum + run.lineup, 0) / runs.length)}`)
  }
}

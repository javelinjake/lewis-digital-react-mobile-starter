import type { GameConfig } from './config'
import type { Position } from './positions'
import { createRng, poisson } from '@ld/utils/random/rng'
import { ROLE_WEIGHTS } from './positions'

const MAX_EXPECTED_GOALS = 8

/** Goals each side is expected to score. A stronger attack against a weaker defence scores more, squared. */
export function expectedGoals(att: number, opponentDef: number, config: GameConfig): number {
  // No defence at all concedes as much as the cap allows (and nothing if there was no attack either).
  if (!(opponentDef > 0))
    return att > 0 ? MAX_EXPECTED_GOALS : 0
  // Capped so an absurd mismatch cannot produce an absurd score.
  return Math.min(MAX_EXPECTED_GOALS, config.match.xgScale * (att / opponentDef) ** 2)
}

export interface Odds {
  win: number
  draw: number
  loss: number
}

const MAX_GOALS = 14

function poissonRow(mean: number): number[] {
  const row = [Math.exp(-mean)]
  for (let goals = 1; goals <= MAX_GOALS; goals++)
    row.push(row[goals - 1] * mean / goals)
  return row
}

/** Chance of a win, draw and loss before kick-off, from the same maths the match itself uses. */
export function winProbabilities(att: number, def: number, opponentAtt: number, opponentDef: number, config: GameConfig): Odds {
  const ours = poissonRow(expectedGoals(att, opponentDef, config))
  const theirs = poissonRow(expectedGoals(opponentAtt, def, config))
  let win = 0
  let draw = 0
  let loss = 0
  for (let a = 0; a <= MAX_GOALS; a++) {
    for (let b = 0; b <= MAX_GOALS; b++) {
      const p = ours[a] * theirs[b]
      if (a > b)
        win += p
      else if (a === b)
        draw += p
      else
        loss += p
    }
  }
  const total = win + draw + loss
  return { win: win / total, draw: draw / total, loss: loss / total }
}

export type MatchSide = 'for' | 'against'
export type MatchEventKind = 'goal' | 'save' | 'miss'

/** One thing that happens in the replay, in match minutes. `slot` is the lineup slot of the player involved. */
export interface MatchEvent {
  minute: number
  side: MatchSide
  kind: MatchEventKind
  slot: number
}

export interface MatchInput {
  att: number
  def: number
  /** Roles and strengths of our five slots, to choose who scores. */
  slots: ReadonlyArray<{ role: Position, score: number }>
  opponent: { att: number, def: number, roles: readonly Position[] }
  /** Extra ATT for this match from the warm-up kick, as a fraction (0.1 is +10%). */
  warmupBonus?: number
  seed: number | string
}

export type MatchResult = 'win' | 'draw' | 'loss'

export interface MatchOutcome {
  goalsFor: number
  goalsAgainst: number
  result: MatchResult
  expectedFor: number
  expectedAgainst: number
  /** Goals and near misses by minute, for the pixel replay. */
  events: MatchEvent[]
}

/** Who scores: more likely the attackers, and the higher their slot score. */
function pickScorer(rng: ReturnType<typeof createRng>, weights: number[]): number {
  return rng.weighted(weights.some(weight => weight > 0) ? weights : weights.map(() => 1))
}

/**
 * Plays one match. Each side's goals are a Poisson draw from its expected goals; the same seed always gives the same
 * match, so a missed fixture can be played later and a replay can be shown again. Goals are placed on the clock and
 * given scorers; extra chances (saved or missed) make the replay worth watching.
 */
export function playMatch(input: MatchInput, config: GameConfig): MatchOutcome {
  const rng = createRng(input.seed)
  const att = input.att * (1 + (input.warmupBonus ?? 0))
  const expectedFor = expectedGoals(att, input.opponent.def, config)
  const expectedAgainst = expectedGoals(input.opponent.att, input.def, config)

  const goalsFor = poisson(rng.fork('goals-for'), expectedFor)
  const goalsAgainst = poisson(rng.fork('goals-against'), expectedAgainst)

  const ourWeights = input.slots.map(slot => slot.score * ROLE_WEIGHTS[slot.role].att)
  const theirWeights = input.opponent.roles.map(role => ROLE_WEIGHTS[role].att)
  const clock = rng.fork('clock')
  const scorers = rng.fork('scorers')

  const events: MatchEvent[] = []
  const add = (side: MatchSide, kind: MatchEventKind, weights: number[]) =>
    events.push({ minute: clock.int(1, 90), side, kind, slot: pickScorer(scorers, weights) })

  for (let goal = 0; goal < goalsFor; goal++)
    add('for', 'goal', ourWeights)
  for (let goal = 0; goal < goalsAgainst; goal++)
    add('against', 'goal', theirWeights)

  const chances = rng.fork('chances')
  for (const [side, expected, weights] of [['for', expectedFor, ourWeights], ['against', expectedAgainst, theirWeights]] as const) {
    const extra = poisson(chances.fork(side), Math.max(0.6, expected * 1.2))
    for (let chance = 0; chance < extra; chance++)
      add(side, chances.next() < 0.5 ? 'save' : 'miss', [...weights])
  }

  events.sort((a, b) => a.minute - b.minute || (a.kind === 'goal' ? -1 : 1))
  return {
    goalsFor,
    goalsAgainst,
    result: goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss',
    expectedFor,
    expectedAgainst,
    events,
  }
}

export type WarmupZone = 'gold' | 'green' | 'miss'

/** ATT bonus for the next match from the warm-up kick: gold +10%, green +5%, a miss +2%. */
export function warmupBonus(zone: WarmupZone, config: GameConfig): number {
  return zone === 'gold' ? config.match.warmupGold : zone === 'green' ? config.match.warmupGreen : config.match.warmupMiss
}

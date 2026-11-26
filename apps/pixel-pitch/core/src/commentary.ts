import type { GameConfig } from './config'
import type { FixtureResult } from './league'
import type { MatchEvent, MatchSide } from './match'
import type { Position } from './positions'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { FULL_TIMES, GOAL_OPENERS_AGAINST, GOAL_OPENERS_FOR, GOAL_WEIGHTS, GOALS, HALF_TIMES, INCIDENTS, KICKOFFS, MISSES, OWN_GOAL, SAVES } from './commentary-lines'
import type { GoalType, MissType, Play, SaveType } from './commentary-lines'
import { FORMATIONS } from './positions'

export type MomentKind = 'kickoff' | 'goal' | 'save' | 'miss' | 'incident' | 'halftime' | 'fulltime'

/**
 * One moment of the written report. A chance has two beats: the `setup` (what is happening) and then the `outcome`
 * (what came of it). Kick-off, half-time, full-time and incidents have only a `setup`.
 */
export interface MatchMoment {
  /** Match minute. 0 is the kick-off. */
  minute: number
  kind: MomentKind
  /** Whose moment it is: our side ('for'), theirs ('against') or neither. */
  side: MatchSide | null
  setup: string
  outcome: string | null
  /** The score once this moment has happened, ours first. */
  score: [number, number]
}

interface Vars {
  /** The player on the ball. */
  p: string
  /** A team-mate of `p`. */
  q: string
  /** The goalkeeper defending against `p`. */
  gk: string
  /** The attacking side's own goalkeeper. */
  own: string
  /** An opposing outfield player. */
  d: string
  /** The side attacking. */
  team: string
  /** The side defending. */
  opp: string
  /** Only in kick-off, half-time and full-time lines. */
  half?: string
  score?: string
}

function fill(template: string, vars: Vars) {
  return template.replace(/\{(\w+)\}/g, (_, key: keyof Vars) => vars[key] ?? '')
}

const rolesOf = (side: MatchSide, fixture: Pick<FixtureResult, 'formation' | 'rival'>): readonly Position[] =>
  FORMATIONS[side === 'for' ? fixture.formation : fixture.rival.formation].roles

export interface CommentaryInput {
  clubName: string
  fixture: Pick<FixtureResult, 'events' | 'goalsFor' | 'goalsAgainst' | 'result' | 'formation' | 'rival' | 'squads'>
  config: Pick<GameConfig, 'match'>
  /** Fixes which moments and lines are chosen. The same seed always gives the same report. */
  seed: string | number
}

/** The chance of an own goal instead of the usual finish, when a goal is scored. */
const OWN_GOAL_CHANCE = 0.04

/**
 * Turns a match's events into a short report of its big moments, in the voice of a 5-a-side commentator: the kick-off,
 * every goal, a handful of the best saves and misses (the match has more; the report keeps what is worth reading),
 * a little colour, half-time and full-time. The goals, and the score after each, are exactly those of the match. A
 * quiet match is topped up to `minChances` with saves and misses, which change nothing on the scoreboard.
 */
export function commentate(input: CommentaryInput): MatchMoment[] {
  const { clubName, fixture, config } = input
  const rng = createRng(hashSeed('commentary', input.seed))
  const minutes = config.match.minutes
  const half = Math.floor(minutes / 2)
  const opp = fixture.rival.name
  const report = config.match.report

  const used = new Set<string>()
  const choose = (pool: readonly string[]): string => {
    const fresh = pool.filter(entry => !used.has(entry))
    const chosen = rng.pick(fresh.length > 0 ? fresh : pool)
    used.add(chosen)
    return chosen
  }

  const squadOf = (side: MatchSide) => (side === 'for' ? fixture.squads.ours : fixture.squads.theirs)
  const outfield = (side: MatchSide) => rolesOf(side, fixture).flatMap((role, slot) => (role === 'GK' ? [] : [slot]))
  const keeper = (side: MatchSide) => squadOf(side)[Math.max(0, rolesOf(side, fixture).indexOf('GK'))]
  const other = (side: MatchSide): MatchSide => (side === 'for' ? 'against' : 'for')
  const pickOutfield = (side: MatchSide, not?: number) => {
    const slots = outfield(side).filter(slot => slot !== not)
    return rng.pick(slots.length > 0 ? slots : outfield(side))
  }

  const varsFor = (side: MatchSide, scorer?: number): Vars => {
    const pSlot = scorer ?? pickOutfield(side)
    const qSlot = pickOutfield(side, pSlot)
    return {
      p: squadOf(side)[pSlot],
      q: squadOf(side)[qSlot],
      gk: keeper(other(side)),
      own: keeper(side),
      d: squadOf(other(side))[pickOutfield(other(side))],
      team: side === 'for' ? clubName : opp,
      opp: side === 'for' ? opp : clubName,
    }
  }

  const moments: MatchMoment[] = []
  let score: [number, number] = [0, 0]
  const add = (minute: number, kind: MomentKind, side: MatchSide | null, setup: string, outcome: string | null = null) =>
    moments.push({ minute, kind, side, setup, outcome, score: [score[0], score[1]] })
  const scoreText = (ours: number, theirs: number) => `${ours}–${theirs}`

  add(0, 'kickoff', null, fill(choose(KICKOFFS), { ...varsFor('for'), team: clubName, opp, half: String(half) }))

  // Which events become moments: every goal, then the chances that matter most (near a goal, late, ours) up to the budget.
  const events = [...fixture.events].sort((a, b) => a.minute - b.minute)
  const goals = events.filter(event => event.kind === 'goal')
  const spare = Math.max(0, report.maxMoments - goals.length)
  const ranked = events
    .filter(event => event.kind !== 'goal')
    .map(event => ({
      event,
      weight: rng.next()
        + (goals.some(goal => Math.abs(goal.minute - event.minute) <= 1) ? 0.6 : 0)
        + (event.minute >= minutes - 5 ? 0.4 : 0)
        + (event.side === 'for' ? 0.2 : 0),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, spare)
    .map(entry => entry.event)
  const chosen = new Set<MatchEvent>([...goals, ...ranked])

  const ourShare = (events.filter(event => event.side === 'for').length + 1) / (events.length + 2)
  type Item = { minute: number } & ({ event: MatchEvent } | { incident: MatchSide })
  const timeline: Item[] = events.filter(event => chosen.has(event)).map(event => ({ minute: event.minute, event }))
  const crowded = new Set(timeline.flatMap(item => [item.minute - 1, item.minute, item.minute + 1]))

  // A quiet match still gets a few chances worth reading: saves and misses that change nothing on the scoreboard.
  for (let tries = 0; timeline.length < report.minChances && tries < 40; tries++) {
    const minute = rng.int(2, minutes - 2)
    if (crowded.has(minute) || Math.abs(minute - half) <= 1)
      continue
    const side: MatchSide = rng.next() < ourShare ? 'for' : 'against'
    const extra: MatchEvent = { minute, side, kind: rng.next() < 0.5 ? 'save' : 'miss', slot: pickOutfield(side) }
    chosen.add(extra)
    crowded.add(minute - 1).add(minute).add(minute + 1)
    timeline.push({ minute, event: extra })
  }

  // A little colour in the quiet spells: at most `incidents`, never next to a chance or the break.
  for (let incident = rng.int(0, report.incidents), tries = 0; incident > 0 && tries < 20; tries++) {
    const minute = rng.int(2, minutes - 2)
    if (crowded.has(minute) || Math.abs(minute - half) <= 1)
      continue
    crowded.add(minute - 1).add(minute).add(minute + 1)
    timeline.push({ minute, incident: rng.next() < ourShare ? 'for' : 'against' })
    incident--
  }
  timeline.sort((a, b) => a.minute - b.minute)

  let halfTimeDone = false
  const halfTime = () => {
    if (halfTimeDone)
      return
    halfTimeDone = true
    const [ours, theirs] = score
    const kind = ours + theirs === 0 ? 'scoreless' : ours > theirs ? 'leading' : ours < theirs ? 'trailing' : 'level'
    add(half, 'halftime', null, fill(choose(HALF_TIMES[kind]), { ...varsFor('for'), team: clubName, opp, score: scoreText(ours, theirs), half: String(half) }))
  }

  for (const item of timeline) {
    if (item.minute > half)
      halfTime()

    if ('incident' in item) {
      add(item.minute, 'incident', item.incident, fill(choose(INCIDENTS), varsFor(item.incident)))
      continue
    }

    const { event } = item
    const side = event.side
    const attackers = outfield(side)
    // The engine picks a shooter by slot; a goalkeeper is never picked, but stay safe if a lineup had none.
    const slot = attackers.includes(event.slot) ? event.slot : attackers[0]
    const vars = varsFor(side, slot)

    // A moment the player played themselves: told as it happened, not drawn from the usual lines.
    if (event.chance === 'save') {
      add(event.minute, 'save', side, fill('{p} is clean through for {team}. One on one.', vars), fill('Saved! {own} gets down to it and the goal is kept out.', { ...vars, own: keeper(other(side)) }))
      continue
    }
    if (event.chance && event.kind === 'goal') {
      score = side === 'for' ? [score[0] + 1, score[1]] : [score[0], score[1] + 1]
      const setup = event.chance === 'penalty' ? 'Penalty to {team}! {p} places the ball on the spot.' : 'Free kick to {team}, just outside the box. {p} stands over it.'
      const finish = event.chance === 'penalty' ? 'Sent the keeper the wrong way. Scored!' : 'Over the wall and in. What a strike!'
      add(event.minute, 'goal', side, fill(setup, vars), `${fill(finish, vars)} (${scoreText(score[0], score[1])})`)
      continue
    }

    if (event.kind === 'save') {
      const play = SAVES[rng.pick(Object.keys(SAVES) as SaveType[])]
      add(event.minute, 'save', side, fill(choose(play.setup), vars), fill(choose(play.outcome), vars))
    }
    else if (event.kind === 'miss') {
      const play = MISSES[rng.pick(Object.keys(MISSES) as MissType[])]
      add(event.minute, 'miss', side, fill(choose(play.setup), vars), fill(choose(play.outcome), vars))
    }
    else {
      const before = score[0] - score[1]
      score = side === 'for' ? [score[0] + 1, score[1]] : [score[0], score[1] + 1]
      const after = score[0] - score[1]
      const lead = side === 'for' ? after : -after
      const wasLead = side === 'for' ? before : -before

      let play: Play
      if (rng.next() < OWN_GOAL_CHANCE) {
        play = OWN_GOAL
      }
      else {
        const weights = GOAL_WEIGHTS[rolesOf(side, fixture)[slot] as 'FWD' | 'MID' | 'DEF'] ?? GOAL_WEIGHTS.FWD
        const types = Object.keys(weights) as GoalType[]
        play = GOALS[types[rng.weighted(types.map(type => weights[type] ?? 0))]]
      }

      const total = score[0] + score[1]
      const context
        = event.minute <= 2 ? 'Straight from the start!'
          : lead === 0 ? `That levels it at ${score[0]}–${score[1]}.`
            : lead === 1 && wasLead <= 0 ? `${vars.team} take the lead.`
              : total === 1 ? 'The opener.'
                : wasLead < 0 ? 'A goal back. Game on.'
                  : lead >= 3 ? `That is ${lead} in front now.`
                    : event.minute >= minutes - 3 ? 'Late drama!' : ''
      const opener = fill(rng.pick(side === 'for' ? GOAL_OPENERS_FOR : GOAL_OPENERS_AGAINST), vars)
      const finish = fill(choose(play.outcome), vars)
      add(event.minute, 'goal', side, fill(choose(play.setup), vars), `${opener} ${finish}${context ? ` ${context}` : ''} (${scoreText(score[0], score[1])})`)
    }
  }
  halfTime()

  const [ours, theirs] = score
  const margin = ours - theirs
  const kind = ours === 0 && theirs === 0 ? 'scorelessDraw' : margin >= 3 ? 'bigWin' : margin > 0 ? 'win' : margin === 0 ? 'draw' : margin <= -3 ? 'bigLoss' : 'loss'
  add(minutes, 'fulltime', null, fill(choose(FULL_TIMES[kind]), { ...varsFor('for'), team: clubName, opp, score: scoreText(ours, theirs) }))

  return moments
}

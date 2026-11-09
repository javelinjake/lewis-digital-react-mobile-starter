import type { GameConfig } from './config'
import type { FixtureResult } from './league'
import type { MatchEvent, MatchSide } from './match'
import type { Position } from './positions'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { FORMATIONS } from './positions'

export type CommentaryKind = 'kickoff' | 'build' | 'save' | 'miss' | 'goal' | 'halftime' | 'fulltime'

export interface CommentaryLine {
  /** Match minute. 0 is the kick-off. */
  minute: number
  text: string
  kind: CommentaryKind
  /** Whose moment it is: our side ('for'), theirs ('against') or neither. */
  side: MatchSide | null
  /** The score once this line has happened, ours first. */
  score: [number, number]
}

interface Vars {
  /** The player on the ball. */
  p: string
  /** A team-mate of `p`. */
  q: string
  /** The goalkeeper defending against `p`. */
  gk: string
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

// Everything below is written for 5-a-side: a small pitch, no offside, kick-ins instead of throw-ins, a keeper who
// rushes out and throws or rolls it to start moves, quick free kicks and constant pressing. Several lines per type,
// so a match report is rarely the same twice.

const GOAL_OPENERS = ['GOAL!', 'Goal!', 'It\'s in!', 'Back of the net!', 'What a finish!', 'That\'s gone in!', 'They\'ve scored!']

const GOAL_SOLO: Record<'FWD' | 'MID' | 'DEF', string[]> = {
  FWD: [
    '{p} drops a shoulder, takes one touch and drills it low past {gk}.',
    '{p} gets half a yard on {d} and slots it into the corner.',
    '{p} spins in the tight space and finishes first time.',
    'Cheeky nutmeg on {d}, and {p} rolls it home.',
    '{p} lifts it over the advancing {gk}. Lovely chip.',
    '{p} takes it on the turn and fires into the top corner.',
    'No backlift from {p}, and it flies in at the near post.',
    '{p} pounces on a loose ball and pokes it past {gk}.',
    '{p} wins it back high up the pitch, goes straight through and finishes calmly.',
    '{p} cuts inside {d} and bends it round {gk}.',
    '{gk} parries it but only into {p}\'s path, and the rebound is tapped in.',
    '{p} makes a run across {d} that nobody tracks, takes the pass in stride and finishes.',
  ],
  MID: [
    '{p} drives forward, nobody picks them up, and the shot beats {gk} at the far post.',
    '{p} arrives late at the edge of the area and thumps a half-volley in.',
    '{p} curls one in from the edge of the area.',
    'A rasping drive from {p}, and {gk} gets nowhere near it.',
    '{p} picks up the loose ball and fires through {gk}\'s legs.',
    '{p} sidesteps {d} and steers it in off the inside of the post.',
    'The kick-in routine works, and {p} lets fly first time.',
    '{p} lofts it over {gk}, who was off the line, and it drops in.',
    '{p} shapes up, shifts it onto the left foot and hits it into the bottom corner.',
    '{p} wins the second ball and strikes it sweetly. In off the post.',
  ],
  DEF: [
    '{p} pushes up from the back and powers a shot in at the near post.',
    '{p} wanders forward, gets the ball and crashes it in from distance.',
    '{p} steps out of defence, takes it past {d} and finishes.',
    'A long-range effort from {p} deflects off {d} and loops over {gk}.',
    'Nobody expected that from {p}: a low drive into the bottom corner.',
    '{p} follows their own pass forward and gets away with a speculative shot. In!',
  ],
}

const GOAL_ASSISTED = [
  'Quick one-two between {p} and {q}, and {p} slots it into the corner.',
  '{q} squares it across the face of goal and {p} taps in from a yard.',
  '{q} threads a pass through the tight defence and {p} finishes calmly.',
  '{q} plays it into the channel, {p} runs on and drills it past {gk}.',
  '{q} drags {d} out of position and rolls it into {p}\'s path. Easy finish.',
  'A neat give-and-go between {q} and {p}, who is free to hit it first time.',
  '{q} delivers a long ball from the back, {p} brings it down and volleys home.',
  'From the kick-in, {q} finds {p} at the far post, who steers it in.',
  '{q} whips a corner in and {p} bundles it over the line.',
  '{q}\'s shot is saved by {gk}, but {p} is following up and puts the rebound away.',
  '{q} slips a lovely reverse pass through for {p}, who slides it under {gk}.',
  '{gk} rolls it out to {q}, who is caught by a quick press. {p} picks up the pieces and scores.',
  '{q} wins the ball back on halfway and slips {p} in. One-on-one, and there is only one outcome.',
  'Short corner from {q}, back to {p}, and a low shot nestles in.',
  '{q} pulls it back from the byline and {p} sweeps it in first time.',
]

const SAVES = [
  '{p} tries their luck from distance, but {gk} gets down to save.',
  '{gk} stands tall and smothers {p}\'s effort at the near post.',
  'Good stop! {gk} sticks out a leg to keep out {p}.',
  '{p} is through one-on-one, but {gk} spreads themselves and blocks.',
  '{gk} tips {p}\'s curler round the post.',
  '{p} hits it first time and {gk} reacts brilliantly.',
  '{gk} rushes off the line and gets a hand to {p}\'s shot.',
  '{p}\'s volley is straight at {gk}, who holds on comfortably.',
  'Corner. {gk} palms {p}\'s drive behind.',
  '{gk} denies {p} with a superb reflex stop.',
  '{p} meets the cross but {gk} is equal to the header.',
  '{p} curls one at the far corner and {gk} flies across to push it away.',
]

const MISSES = [
  '{p} blazes over from close range.',
  '{p}\'s shot skids wide of the far post.',
  'Off the post! {p} can\'t believe it.',
  '{p} drags it just wide with only {gk} to beat.',
  '{d} gets a block in on {p}\'s shot.',
  '{p} slips as they shoot and it trickles wide.',
  '{p} sees the shot cannon off the crossbar!',
  'Close! {p}\'s curler clips the outside of the post.',
  '{d} throws a body in the way and {p}\'s shot is blocked.',
  '{p} snatches at it and fires into the side netting.',
  '{p} should have squared it, but goes alone and the angle closes.',
  'A scramble in the area, {p} gets a toe to it, and it rolls just the wrong side of the post.',
]

const BUILD = [
  '{p} and {q} pass it around in the tight space, looking for an opening.',
  '{team} keep the ball well on the small pitch.',
  '{d} makes a firm tackle to stop the break.',
  '{gk} launches it long and {team} win the second ball.',
  'Kick-in for {team}: a short routine, back to {p}.',
  '{p} dribbles into the channel but runs out of room.',
  'Corner to {team}. {q} floats it in and it is cleared.',
  'There is no time to breathe in this format: {team} win it back straight away.',
  '{p} plays a quick one-two with {q} but the final pass is overhit.',
  'Free kick to {team} after {d} clips {p}. Taken quickly.',
  '{opp} press high and force a mistake, but {team} recover.',
  '{gk} throws it out to {p} and {team} start building again.',
  'The pace is relentless, both sides pushing numbers forward.',
  '{p} shows good feet to get away from {d}, but the move breaks down.',
  'A scramble in the area, and {d} hacks it clear.',
  '{team} work a neat triangle between {p}, {q} and the keeper.',
  '{p} tries a speculative effort from halfway. It dips just over.',
  'A word from the referee for {d} after another late challenge.',
  'A bobbling ball catches out {p} on the touch.',
  '{q} sets {p} up on the edge of the area, but {d} gets across.',
  '{team} switch play quickly. {q} to {p}, then back again, looking for the gap.',
  'The ball runs out for a kick-in. {opp} take it short.',
  '{p} nudges it past {d} but the keeper {gk} comes out to gather.',
  'Hardly a pause for breath. It is end to end on this small pitch.',
  '{gk} claims a cross with confidence and rolls it out to start another attack.',
  '{opp} keep a compact shape and {team} cannot find a way through.',
  '{p} tries a rabona on the touchline. It does not quite come off.',
  '{team} are camped in the opposition half, passing it around quickly.',
]

const KICKOFFS = [
  'We are underway! {team} against {opp}, five a side.',
  'The whistle goes and {team} get us started.',
  '{team} v {opp}: two halves of {half} minutes and no room to hide.',
  'Kick-off. A small pitch, a fast ball and five players each. Here we go.',
  '{opp} kick off and straight away it is a high tempo.',
]

const HALF_TIMES = {
  leading: ['Half-time. {team} lead {score}, but it is far from over on a pitch this small.', 'The whistle goes for half-time with {team} ahead, {score}.'],
  trailing: ['Half-time, and {team} trail {score}. A word from the manager is needed.', 'Break in play. {team} are behind, {score}, and have {half} minutes to turn it around.'],
  level: ['Half-time: {score}. Nothing in it so far.', 'All square at the break, {score}. Both keepers have been busy.'],
  scoreless: ['Half-time, and it is goalless. Plenty of effort, not much end product.', 'Nil-nil at the break. Both defences are on top.'],
}

const FULL_TIMES = {
  bigWin: ['Full time! {team} win {score}. A really dominant display.', 'It is all over, {team} {score}. Never in doubt.'],
  win: ['Full time. {team} take the win, {score}.', 'The final whistle goes and {team} have the three points, {score}.'],
  draw: ['Full time. It finishes {score}, and the points are shared.', 'The whistle goes. {score}, a fair result in the end.'],
  scorelessDraw: ['Full time, goalless ({score}). Two good defences, and the points are shared.', 'No goals, {score}. The keepers were the heroes and the points are shared.'],
  loss: ['Full time. {team} are beaten, {score}.', 'It is over. {score}, and {opp} take the points.'],
  bigLoss: ['Full time, and it is a heavy defeat: {score}. A day to forget.', 'The final whistle brings {team} some relief. {score} to {opp}.'],
}

const rolesOf = (side: MatchSide, fixture: Pick<FixtureResult, 'formation' | 'rival'>): readonly Position[] =>
  FORMATIONS[side === 'for' ? fixture.formation : fixture.rival.formation].roles

export interface CommentaryInput {
  clubName: string
  fixture: Pick<FixtureResult, 'events' | 'goalsFor' | 'goalsAgainst' | 'result' | 'formation' | 'rival' | 'squads'>
  config: Pick<GameConfig, 'match'>
  /** Fixes which lines are chosen. The same seed always gives the same report. */
  seed: string | number
}

/**
 * Turns a match's events into a minute-by-minute report in the voice of a 5-a-side commentator. The scorers, saves and
 * misses are exactly those in `events`, so the report always agrees with the result; what is added is colour (build-up
 * play, assists, who was beaten) chosen from a pool of lines with a seed, so two reports rarely read alike.
 */
export function commentate(input: CommentaryInput): CommentaryLine[] {
  const { clubName, fixture, config } = input
  const rng = createRng(hashSeed('commentary', input.seed))
  const minutes = config.match.minutes
  const half = Math.floor(minutes / 2)
  const opp = fixture.rival.name

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

  const varsFor = (side: MatchSide, scorer?: number, mate?: number): Vars & { pSlot: number } => {
    const pSlot = scorer ?? pickOutfield(side)
    const qSlot = mate ?? pickOutfield(side, pSlot)
    return {
      pSlot,
      p: squadOf(side)[pSlot],
      q: squadOf(side)[qSlot],
      gk: keeper(other(side)),
      d: squadOf(other(side))[pickOutfield(other(side))],
      team: side === 'for' ? clubName : opp,
      opp: side === 'for' ? opp : clubName,
    }
  }

  const lines: CommentaryLine[] = []
  let score: [number, number] = [0, 0]
  const add = (minute: number, text: string, kind: CommentaryKind, side: MatchSide | null) =>
    lines.push({ minute, text, kind, side, score: [score[0], score[1]] })
  const scoreText = (ours: number, theirs: number) => `${ours}–${theirs}`

  add(0, fill(choose(KICKOFFS), { ...varsFor('for'), team: clubName, opp, half: String(half) }), 'kickoff', null)

  const events = [...fixture.events].sort((a, b) => a.minute - b.minute)
  const ourShare = (events.filter(event => event.side === 'for').length + 1) / (events.length + 2)

  // Quiet stretches get a line of build-up play every two to three minutes.
  const busy = new Set(events.flatMap(event => [event.minute - 1, event.minute, event.minute + 1]))
  const fillers: number[] = []
  for (let minute = rng.int(2, 3); minute < minutes; minute += rng.int(2, 3)) {
    if (!busy.has(minute) && Math.abs(minute - half) > 0)
      fillers.push(minute)
  }

  type Item = { minute: number } & ({ event: MatchEvent } | { filler: true })
  const timeline: Item[] = [
    ...events.map(event => ({ minute: event.minute, event })),
    ...fillers.map(minute => ({ minute, filler: true as const })),
  ].sort((a, b) => a.minute - b.minute)

  let halfTimeDone = false
  const halfTime = () => {
    if (halfTimeDone)
      return
    halfTimeDone = true
    const [ours, theirs] = score
    const kind = ours + theirs === 0 ? 'scoreless' : ours > theirs ? 'leading' : ours < theirs ? 'trailing' : 'level'
    add(half, fill(choose(HALF_TIMES[kind]), { ...varsFor('for'), team: clubName, opp, score: scoreText(ours, theirs), half: String(half) }), 'halftime', null)
  }

  for (const item of timeline) {
    if (item.minute > half)
      halfTime()

    if ('filler' in item) {
      const side: MatchSide = rng.next() < ourShare ? 'for' : 'against'
      add(item.minute, fill(choose(BUILD), varsFor(side)), 'build', side)
      continue
    }

    const { event } = item
    const side = event.side
    const attackers = outfield(side)
    // The engine picks a scorer by slot; a goalkeeper is never picked, but stay safe if a lineup had none.
    const slot = attackers.includes(event.slot) ? event.slot : attackers[0]
    const vars = varsFor(side, slot)

    if (event.kind === 'save') {
      add(event.minute, fill(choose(SAVES), vars), 'save', side)
    }
    else if (event.kind === 'miss') {
      add(event.minute, fill(choose(MISSES), vars), 'miss', side)
    }
    else {
      const before = score[0] - score[1]
      score = side === 'for' ? [score[0] + 1, score[1]] : [score[0], score[1] + 1]
      const after = score[0] - score[1]
      const lead = side === 'for' ? after : -after
      const wasLead = side === 'for' ? before : -before

      const role = rolesOf(side, fixture)[slot] as 'FWD' | 'MID' | 'DEF'
      const assisted = rng.next() < 0.65
      const body = fill(choose(assisted ? GOAL_ASSISTED : GOAL_SOLO[role] ?? GOAL_SOLO.FWD), vars)

      const total = score[0] + score[1]
      const context
        = event.minute <= 2 ? 'Straight from the start!'
          : lead === 0 ? `That levels it at ${score[0]}–${score[1]}.`
            : lead === 1 && wasLead <= 0 ? `${vars.team} take the lead.`
              : total === 1 ? 'The opener.'
                : wasLead < 0 ? 'A goal back. Game on.'
                  : lead >= 3 ? `That is ${lead} in front now.`
                    : event.minute >= minutes - 3 ? 'Late drama!'
                      : ''
      add(event.minute, `${rng.pick(GOAL_OPENERS)} ${body}${context ? ` ${context}` : ''} (${scoreText(score[0], score[1])})`, 'goal', side)
    }
  }
  halfTime()

  const [ours, theirs] = score
  const margin = ours - theirs
  const kind = ours === 0 && theirs === 0 ? 'scorelessDraw' : margin >= 3 ? 'bigWin' : margin > 0 ? 'win' : margin === 0 ? 'draw' : margin <= -3 ? 'bigLoss' : 'loss'
  add(minutes, fill(choose(FULL_TIMES[kind]), { ...varsFor('for'), team: clubName, opp, score: scoreText(ours, theirs) }), 'fulltime', null)

  return lines
}


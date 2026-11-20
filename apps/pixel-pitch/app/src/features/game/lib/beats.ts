import type { MatchMoment } from '@ld/pixel-pitch-core'

/** One thing shown at a time: a chance's setup, then its outcome, or a moment that has only one. */
export interface Beat {
  /** Index into the moments. */
  moment: number
  part: 'setup' | 'outcome'
  /** How long to hold this beat before the next, unless the player taps first. */
  ms: number
}

const SETUP = { min: 1400, max: 3200, perChar: 22 }
const OUTCOME = { min: 2200, max: 4600, perChar: 30 }
/** Kick-off, half-time, full-time and colour: a single beat, read once. */
const SINGLE = { min: 1800, max: 4000, perChar: 26 }

function hold(text: string, pace: { min: number, max: number, perChar: number }) {
  return Math.round(Math.min(pace.max, Math.max(pace.min, text.length * pace.perChar)))
}

/**
 * The beats of a report, in order. The time on each follows its length, so a long line gets longer to read than a
 * short one, and a whole match comes to about half a minute. Tapping moves on sooner; Skip goes to the end.
 */
export function beatsOf(moments: readonly MatchMoment[]): Beat[] {
  return moments.flatMap((moment, index): Beat[] => moment.outcome === null
    ? [{ moment: index, part: 'setup', ms: hold(moment.setup, SINGLE) }]
    : [
        { moment: index, part: 'setup', ms: hold(moment.setup, SETUP) },
        { moment: index, part: 'outcome', ms: hold(moment.outcome, OUTCOME) },
      ])
}

export const totalMs = (beats: readonly Beat[]) => beats.reduce((sum, beat) => sum + beat.ms, 0)

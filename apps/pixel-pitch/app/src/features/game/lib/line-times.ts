import type { CommentaryLine } from '@ld/pixel-pitch-core'

/** A whole match is read in about this long: quick enough to read through, and Skip is always there. */
export const DURATION_MS = 18_000
/** Never faster than this between lines, so each can be read. */
const MIN_GAP_MS = 450

/** When each line appears: spread over the match clock, but never closer together than `MIN_GAP_MS`. */
export function lineTimes(lines: readonly CommentaryLine[], minutes: number): number[] {
  const times: number[] = []
  for (const [index, line] of lines.entries()) {
    const wanted = (line.minute / minutes) * DURATION_MS
    times.push(index === 0 ? 0 : Math.max(wanted, times[index - 1] + MIN_GAP_MS))
  }
  return times
}

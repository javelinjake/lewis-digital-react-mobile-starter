import type { Cabinet, GameConfig } from '@ld/pixel-pitch-core'
import { CABINETS as CABINET_IDS, keepyMax } from '@ld/pixel-pitch-core'

export const CABINETS: Array<{ cabinet: Cabinet, name: string, blurb: string }> = [
  { cabinet: 'kick', name: 'Kick Timer', blurb: 'Five kicks. Stop the marker in the target. A kick after a perfect one counts double.' },
  { cabinet: 'keepy', name: 'Keepy-Uppy', blurb: 'Keep the ball up for 30 seconds. It gets faster. Every tenth ball is gold.' },
  { cabinet: 'pens', name: 'Penalty Shootout', blurb: 'Five penalties. Beat the keeper: the corners are worth double.' },
]

/** The best score a play of each game can reach, for "best 12 / 27". */
export function topScore(cabinet: Cabinet, config: GameConfig) {
  const { kick, pens } = config.minigames
  return cabinet === 'keepy' ? keepyMax(config) : cabinet === 'pens' ? pens.rounds * 2 : 3 + (kick.rounds - 1) * 6
}

/** Whether a route parameter names a cabinet that exists. */
export function isCabinet(value: string | undefined): value is Cabinet {
  return CABINET_IDS.includes(value as Cabinet)
}

import type { Cabinet, GameConfig } from '@ld/pixel-pitch-core'
import { CABINETS as CABINET_IDS, cabinetMax } from '@ld/pixel-pitch-core'

export interface CabinetInfo {
  cabinet: Cabinet
  name: string
  /** One line for the arcade's list. */
  blurb: string
  /** How to play, on the screen before a play starts. */
  how: string
}

/** Every arcade game, in the order the arcade lists them. */
export const CABINETS: CabinetInfo[] = [
  { cabinet: 'kick', name: 'Kick Timer', blurb: 'Five kicks. Stop the marker in the target. A kick after a perfect one counts double.', how: 'Tap KICK! when the marker is in the middle of the target. Five kicks, each a little different: some are fast, some narrow, some move. A kick straight after a perfect one counts double.' },
  { cabinet: 'keepy', name: 'Keepy-Uppy', blurb: 'Tap the ball to keep it up. It drifts about and gets faster. Every tenth ball is gold.', how: 'Tap the ball to kick it up when it drops into the shaded zone. Each kick sends it off to one side, so follow it. Tap too early, or miss the ball, and you stumble. 30 seconds; every tenth ball is gold and counts double.' },
  { cabinet: 'pens', name: 'Penalty Shootout', blurb: 'Five penalties. Beat the keeper: the corners are worth double.', how: 'The aim sweeps across the goal and the keeper shuffles along the line. Tap SHOOT! when the aim is away from the keeper. A goal is 1 point, a corner 2.' },
  { cabinet: 'keeper', name: 'Keeper Reflex', blurb: 'You are in goal. Dive the right way.', how: 'A shot comes at the left, centre or right. Tap that side before it goes in. Dive early and you are beaten. Ten shots, each quicker.' },
  { cabinet: 'pass', name: 'Pass Master', blurb: 'Watch the move, then repeat it.', how: 'Four players pass the ball. Watch the order, then tap the players in the same order. Each round adds a pass. One mistake ends it.' },
  { cabinet: 'dribble', name: 'Dribble Dash', blurb: 'Run the pitch, round the defenders.', how: 'Defenders come down three lanes. Tap left or right to switch lane and go round them. It gets faster. One tackle ends it.' },
  { cabinet: 'targets', name: 'Target Practice', blurb: 'Hit the targets before they go.', how: 'A target appears somewhere in the goal for a moment. Tap it. Miss the target, or be too slow, and it is gone. Fifteen targets, each quicker.' },
  { cabinet: 'cones', name: 'Cone Shuffle', blurb: 'Follow the ball under the cones.', how: 'The ball goes under a cone and the cones swap places. Pick the one with the ball. Five rounds, more swaps and quicker each time.' },
]

/** The best score a play of each game can reach, for "best 12 / 27". */
export function topScore(cabinet: Cabinet, config: GameConfig) {
  return cabinetMax(cabinet, config)
}

/** Whether a route parameter names a cabinet that exists. */
export function isCabinet(value: string | undefined): value is Cabinet {
  return CABINET_IDS.includes(value as Cabinet)
}

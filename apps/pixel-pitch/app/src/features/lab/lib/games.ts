import { CONE_ROUNDS, KEEPER_SHOTS, PASS_ROUNDS, TARGETS } from './rules'

export type LabGameId = 'keeper' | 'pass' | 'dribble' | 'targets' | 'cones'

export interface LabGame {
  id: LabGameId
  name: string
  /** The kind of skill it tests, so the five are easy to tell apart. */
  skill: string
  blurb: string
  how: string
  /** The best possible score, or null when there is no fixed top (Dribble Dash counts defenders). */
  max: number | null
}

/** Prototype mini-games, for trying out. They cost no energy and pay nothing: only a score and a best. */
export const LAB_GAMES: readonly LabGame[] = [
  { id: 'keeper', name: 'Keeper Reflex', skill: 'Reactions', blurb: 'You are in goal. Dive the right way.', how: 'A shot comes at the left, centre or right. Tap that side before it goes in. Dive early and you are beaten. Ten shots, each quicker.', max: KEEPER_SHOTS },
  { id: 'pass', name: 'Pass Master', skill: 'Memory', blurb: 'Watch the move, then repeat it.', how: 'Four players pass the ball. Watch the order, then tap the players in the same order. Each round adds a pass. One mistake ends it.', max: PASS_ROUNDS },
  { id: 'dribble', name: 'Dribble Dash', skill: 'Dodging', blurb: 'Run the pitch, round the defenders.', how: 'Defenders come down three lanes. Tap left or right to switch lane and go round them. It gets faster. One tackle ends it.', max: null },
  { id: 'targets', name: 'Target Practice', skill: 'Accuracy', blurb: 'Hit the targets before they go.', how: 'A target appears somewhere in the goal for a moment. Tap it. Miss the target, or be too slow, and it is gone. Fifteen targets, each quicker.', max: TARGETS },
  { id: 'cones', name: 'Cone Shuffle', skill: 'Watching', blurb: 'Follow the ball under the cones.', how: 'The ball goes under a cone and the cones swap places. Pick the one with the ball. Five rounds, more swaps and quicker each time.', max: CONE_ROUNDS },
]

export function labGame(id: string | undefined) {
  return LAB_GAMES.find(game => game.id === id)
}

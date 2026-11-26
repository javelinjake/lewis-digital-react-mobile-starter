import type { Chance, ChanceKind } from '@ld/pixel-pitch-core'

export const CHANCE_NAME: Record<ChanceKind, string> = { penalty: 'Penalty', freekick: 'Free kick', save: 'Save' }

/** What the player has to do for each kind, in a line. */
export function chanceHow(kind: ChanceKind, freeKickPoints: number) {
  if (kind === 'penalty')
    return 'One penalty. Tap when the ball is where you want to shoot, away from the keeper.'
  if (kind === 'freekick')
    return `One free kick. Stop the marker in the target: ${freeKickPoints === 3 ? 'dead centre' : 'close to the middle'} goes in.`
  return 'One shot at your goal. Tap the ball before it crosses the line.'
}

/** What scoring would do to the match, in words. */
export function chanceStakes(chance: Chance) {
  const after = chance.kind === 'save' ? [chance.goalsFor, chance.goalsAgainst - 1] : [chance.goalsFor + 1, chance.goalsAgainst]
  const result = after[0] > after[1] ? 'a win' : after[0] === after[1] ? 'a draw' : 'a closer loss'
  return `${chance.goalsFor}–${chance.goalsAgainst} now. ${chance.kind === 'save' ? 'Keep it out' : 'Score'} and it is ${after[0]}–${after[1]}, ${result}.`
}

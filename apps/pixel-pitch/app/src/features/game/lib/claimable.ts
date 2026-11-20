import type { GameConfig, GameResponse } from '@ld/pixel-pitch-core'
import { dayIndex, isSetComplete, nextCalendarDay, tierReached } from '@ld/pixel-pitch-core'

/** How much is waiting to be claimed, for the badges on the hub: goals, the free pack, the calendar, Pass tiers and album sets. */
export function claimable(game: GameResponse, config: GameConfig, albumSetList: ReadonlyArray<{ id: string, playerIds: readonly string[] }> = []) {
  const { state } = game.club
  const today = dayIndex(game.now, config)

  const goals = state.daily.goals.filter(goal => goal.progress >= goal.target && !goal.claimed).length
    + (state.daily.freePackClaimed ? 0 : 1)
    + (nextCalendarDay(state.calendar, today) === null ? 0 : 1)

  const reached = tierReached(state, config)
  let pass = 0
  for (let tier = 1; tier <= reached; tier++) {
    if (config.pass.free[tier - 1] && !state.pass.claimedFree.includes(tier))
      pass += 1
    if (state.idle.hasPass && !state.pass.claimedPremium.includes(tier))
      pass += 1
  }

  const collected = new Set(state.album.collected)
  const album = albumSetList.filter(set => isSetComplete({ ...set, name: '', nation: 0, position: 'GK', playerIds: [...set.playerIds] }, collected) && !state.album.claimed.includes(set.id)).length

  return { goals, pass, album }
}

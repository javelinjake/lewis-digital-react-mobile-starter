import type { NotificationPlan } from '@ld/native/notification-plan'
import type { GameConfig, GameResponse } from '@ld/pixel-pitch-core'
import { challengePlayed, clubNotificationTimes, dayIndex, gapBefore } from '@ld/pixel-pitch-core'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** Matches the results summary waits for, so it is one alert for a stretch away, not one a match. */
const SUMMARY_MATCHES = 3

/**
 * What the phone should say, and when, for a club: the shelf filling, a summary of the matches played, the arcade
 * being ready (full energy or a full tray), Big Chances waiting and the daily challenge. Times come from the rules the server uses. Alerts already in the past are dropped later, with the
 * player's quiet hours and switches, by the shared planner.
 */
export function buildNotificationPlans(game: GameResponse, config: GameConfig): NotificationPlan[] {
  const { state } = game.club
  const times = clubNotificationTimes(state, config, game.now)
  // The next morning's challenge: 9 hours into the game's next day.
  // The kick-off of the last match in the summary: the next one and the ones after it, by the league's schedule.
  let summaryAt = times.nextKickoffAt
  for (let match = 1; match < SUMMARY_MATCHES; match++)
    summaryAt += gapBefore(state.league.fixtureNo + match, config)
  const tomorrow = (dayIndex(game.now, config) + 1) * DAY + config.daily.dayStartOffsetMinutes * MINUTE
  return [
    ...(times.shelfFullAt ? [{ id: 1, type: 'shelf-full', at: times.shelfFullAt, title: 'Your pack shelf is full', body: 'Open some packs so it can start filling again.' }] : []),
    // One summary once a few matches have been played, a minute after the last kicks off: not one alert a match.
    { id: 2, type: 'full-time', at: summaryAt + MINUTE, title: 'Results are in', body: `${game.club.name} have played ${SUMMARY_MATCHES} matches. See how they went, and any Big Chances.` },
    { id: 3, type: 'trays-full', at: times.arcadeReadyAt, title: 'The arcade is ready', body: 'Your energy is back and tokens are waiting. Have a go.' },
    ...(state.chances.length > 0 ? [{ id: 4, type: 'big-chances', at: game.now + 6 * HOUR, title: 'Big Chances waiting', body: `${state.chances.length} ${state.chances.length === 1 ? 'chance' : 'chances'} to turn a result your way.` }] : []),
    { id: 5, type: 'challenge', at: challengePlayed(state, game.now, config) ? tomorrow + 9 * HOUR : game.now + 3 * HOUR, title: 'Daily challenge ready', body: 'Today\'s challenge is waiting: one go, same pattern for everyone.' },
  ]
}

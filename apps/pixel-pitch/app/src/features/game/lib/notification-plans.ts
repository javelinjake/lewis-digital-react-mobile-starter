import type { NotificationPlan } from '@ld/native/notification-plan'
import type { GameConfig, GameResponse } from '@ld/pixel-pitch-core'
import { clubNotificationTimes } from '@ld/pixel-pitch-core'

const MINUTE = 60_000

/**
 * What the phone should say, and when, for a club: the shelf filling, the next match being played and the arcade
 * trays filling. Times come from the rules the server uses. Alerts already in the past are dropped later, with the
 * player's quiet hours and switches, by the shared planner.
 */
export function buildNotificationPlans(game: GameResponse, config: GameConfig): NotificationPlan[] {
  const times = clubNotificationTimes(game.club.state, config, game.now)
  return [
    ...(times.shelfFullAt ? [{ id: 1, type: 'shelf-full', at: times.shelfFullAt, title: 'Your pack shelf is full', body: 'Open some packs so it can start filling again.' }] : []),
    // A minute after kick-off, so the match has been played when the player looks.
    { id: 2, type: 'full-time', at: times.nextKickoffAt + MINUTE, title: 'Full time', body: `${game.club.name}'s match has been played. See how it went.` },
    { id: 3, type: 'trays-full', at: times.traysFullAt, title: 'Arcade trays are full', body: 'Collect your tokens and have a go.' },
  ]
}

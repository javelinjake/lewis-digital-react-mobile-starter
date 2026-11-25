import type { GameResponse, Reward, WelcomeBackEvent } from '@ld/pixel-pitch-core'
import { pendingStadiumCoins, pendingTrayTokens } from '@ld/pixel-pitch-core'
import { art } from '../lib/art'
import { leagueName } from '../lib/club'
import { useGameConfig } from '../queries/use-game'
import { RewardText } from './RewardText'
import { Icon } from './sprites'

/** Adds up rewards of the same kind (and kit), for one line. */
function totalRewards(rewards: Reward[]): Reward[] {
  const totals = new Map<string, Reward>()
  for (const reward of rewards) {
    const key = `${reward.kind}-${reward.id ?? ''}`
    const seen = totals.get(key)
    totals.set(key, seen ? { ...seen, amount: seen.amount + reward.amount } : reward)
  }
  return [...totals.values()]
}

/** What happened while the player was away. Shown once per sync that had news. */
export function WelcomeBack({ game, events, claims, claiming, onClaimAll, onClose }: { game: GameResponse, events: WelcomeBackEvent[], claims: number, claiming: boolean, onClaimAll: () => void, onClose: () => void }) {
  const config = useGameConfig()
  const { idle } = game.club.state
  const stadium = pendingStadiumCoins(idle, config, game.now)
  const trays = pendingTrayTokens(idle, config, game.now)
  const promotions = events.filter(event => event.type === 'promotion')
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Welcome back">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 border-2 border-primary bg-base-100 p-5">
        <img src={art('text/banner_welcome_back.png')} alt="Welcome back" className="pixel h-auto w-48" />
        <ul className="flex w-full flex-col gap-2 text-lg">
          {stadium > 0
            ? (
                <li>
                  <Icon path="icons/currency_coin.png" />
                  {` ${stadium.toLocaleString('en-GB')} coins waiting in the stadium`}
                </li>
              )
            : null}
          {trays > 0
            ? (
                <li>
                  <Icon path="icons/currency_token.png" />
                  {` ${trays} tokens waiting in the arcade`}
                </li>
              )
            : null}
          {events.map((event) => {
            if (event.type === 'matches') {
              return (
                <li key={event.type} className="flex flex-col gap-1">
                  <span>
                    <Icon path="icons/ui_whistle.png" />
                    {' '}
                    {event.played}
                    {' '}
                    {event.played === 1 ? 'match' : 'matches'}
                    {' played: '}
                    {event.won}
                    W
                    {' '}
                    {event.drawn}
                    D
                    {' '}
                    {event.lost}
                    L
                  </span>
                  <span>
                    <Icon path="icons/currency_coin.png" />
                    {' +'}
                    {event.coins}
                    {' coins'}
                  </span>
                  {event.skipped > 0 ? <span className="text-muted">{`${event.skipped} older matches were not played while you were away.`}</span> : null}
                </li>
              )
            }
            if (event.type === 'promotion') {
              // A long time away can promote more than once: one line, at the highest league, with every reward.
              if (event !== promotions.at(-1))
                return null
              return (
                <li key="promotion" className="flex flex-col gap-1">
                  <span className="text-primary">{`Promoted to ${leagueName(event.tier)}!${promotions.length > 1 ? ` (${promotions.length} promotions)` : ''} Your reward:`}</span>
                  <span className="flex flex-wrap gap-x-3">
                    {totalRewards(promotions.flatMap(promotion => promotion.rewards)).map(reward => <RewardText key={`${reward.kind}-${reward.id ?? ''}`} reward={reward} />)}
                  </span>
                </li>
              )
            }
            if (event.type === 'season-end') {
              return (
                <li key="season-end" className="flex flex-col gap-1">
                  <span className="text-primary">The season ended. Rewards you had reached but not claimed:</span>
                  <span className="flex flex-wrap gap-x-3">
                    {totalRewards(event.rewards).map(reward => <RewardText key={`${reward.kind}-${reward.id ?? ''}`} reward={reward} />)}
                  </span>
                </li>
              )
            }
            if (event.type === 'packs') {
              return (
                <li key={event.type}>
                  <Icon path="icons/currency_pack.png" />
                  {` ${event.gained} ${event.gained === 1 ? 'pack' : 'packs'} on the shelf`}
                </li>
              )
            }
            return (
              <li key={event.type}>
                <Icon path="icons/currency_gem.png" />
                {` +${event.amount} gems today`}
              </li>
            )
          })}
        </ul>
        {claims > 0
          ? (
              <>
                <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" disabled={claiming} onClick={onClaimAll}>{claims === 1 ? 'Claim it' : `Claim all (${claims})`}</button>
                <button type="button" className="btn btn-ghost min-h-11 w-full" onClick={onClose}>Let's go</button>
              </>
            )
          : <button type="button" className="btn btn-primary min-h-11 w-full font-display text-xs" onClick={onClose}>Let's go</button>}
      </div>
    </div>
  )
}

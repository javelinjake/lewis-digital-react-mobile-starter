import type { GameResponse } from '@ld/pixel-pitch-core'
import { paidFriendliesLeft } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useNavigate } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'

/** A friendly whenever you like: played at once with your lineup, coins for the first few each day. */
export function FriendlyCard({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useServerNow(game)
  const play = useGameAction(() => gameApi.playFriendly())
  const left = paidFriendliesLeft(game.club.state, config, now)
  const { winCoins, lossCoins } = config.friendly

  return (
    <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Friendly">
      <h2>Friendly</h2>
      <span className="text-muted">
        {left > 0
          ? `Play now against a side from your league. ${lossCoins}–${winCoins} coins, no league points. ${left} paid ${left === 1 ? 'friendly' : 'friendlies'} left today.`
          : 'No more coins from friendlies today, but you can still play them to try out a lineup. Back tomorrow for more.'}
      </span>
      <button
        type="button"
        className="btn btn-outline min-h-11 font-display text-xs"
        disabled={play.isPending}
        onClick={() => play.mutate(undefined, {
          onSuccess: response => navigate(`/match/${response.fixture.no}`),
          onError: error => toast.push(formatError(error), 'error'),
        })}
      >
        {play.isPending ? 'Kicking off…' : 'Play a friendly'}
      </button>
    </section>
  )
}

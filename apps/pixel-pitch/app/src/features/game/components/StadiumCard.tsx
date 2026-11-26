import type { GameResponse } from '@ld/pixel-pitch-core'
import { pendingStadiumCoins } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'

const HOUR = 60 * 60 * 1000

/** "3h 12m" from a length of time. */
function span(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/**
 * The idle loop, first on the club screen: the stadium earns coins while you are away, up to a few hours' worth. One
 * tap collects them. Underneath, what the stadium earns now and what the next level would.
 */
export function StadiumCard({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const now = useServerNow(game)
  const { state } = game.club
  const level = state.idle.stadiumLevel
  const levels = config.stadium.coinsPerHour.length
  const rate = config.stadium.coinsPerHour[level - 1]
  const nextRate = level < levels ? config.stadium.coinsPerHour[level] : null
  const capHours = state.idle.hasPass ? config.stadium.capHoursWithPass : config.stadium.capHours
  const cap = Math.floor(rate * capHours)
  const pile = pendingStadiumCoins(state.idle, config, now)
  const stored = Math.min(capHours * HOUR, now - state.idle.stadiumCollectedAt)
  const fullAt = state.idle.stadiumCollectedAt + capHours * HOUR
  const full = now >= fullAt
  const cost = level < levels ? config.stadium.upgradeCost[level - 1] : null
  const collect = useGameAction(() => gameApi.collectStadium())
  const upgrade = useGameAction(() => gameApi.upgradeStadium())
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  return (
    <section className="flex flex-col gap-3 border-2 border-slate bg-base-100 p-3" aria-label="Stadium">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="pp-label">{full ? 'Stadium full' : 'While you were away'}</div>
          <div className="text-3xl leading-tight font-bold text-primary tabular-nums">{`+${pile.toLocaleString('en-GB')} coins`}</div>
          <div className="mt-1 h-2 bg-base-200" role="progressbar" aria-label="Stadium pile" aria-valuenow={pile} aria-valuemin={0} aria-valuemax={cap}>
            <div className="h-2 bg-primary" style={{ width: `${Math.min(100, (pile / cap) * 100)}%` }} />
          </div>
          <div className="mt-1 text-sm text-muted">
            {full
              ? `Full: it holds ${capHours}h. Collect to start it again.`
              : `${span(stored)} of ${capHours}h stored · full at ${new Date(fullAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        <button type="button" className="btn btn-primary h-15 w-25 shrink-0 text-lg" aria-label={`Collect ${pile.toLocaleString('en-GB')}`} disabled={pile < 1 || collect.isPending} onClick={() => collect.mutate(undefined, { onError })}>
          Collect
        </button>
      </div>
      <div className="flex items-center gap-3 border-t-2 border-slate pt-2">
        <span className="min-w-0 flex-1 text-sm">
          <span>{`Level ${level} · ${rate} coins an hour`}</span>
          {nextRate !== null ? <span className="block text-muted">{`Level ${level + 1}: ${nextRate} an hour (+${(nextRate - rate) * 24} a day)`}</span> : null}
        </span>
        <button type="button" className="btn btn-outline btn-sm min-h-11 shrink-0" disabled={cost === null || state.coins + pile < cost || upgrade.isPending} onClick={() => upgrade.mutate(undefined, { onError })}>
          {cost === null ? 'Top level' : `Upgrade · ${cost.toLocaleString('en-GB')}`}
        </button>
      </div>
    </section>
  )
}

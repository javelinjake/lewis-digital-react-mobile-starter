import type { GameResponse } from '@ld/pixel-pitch-core'
import { pendingStadiumCoins, stadiumStage } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { art } from '../lib/art'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { Icon } from './sprites'

/** The stadium: coins pile up while you are away (8 hours' worth at most), collect them, and upgrade it for more. */
export function StadiumCard({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const now = useServerNow(game)
  const { state } = game.club
  const level = state.idle.stadiumLevel
  const levels = config.stadium.coinsPerHour.length
  const pile = pendingStadiumCoins(state.idle, config, now)
  const cap = Math.floor(config.stadium.coinsPerHour[level - 1] * (state.idle.hasPass ? config.stadium.capHoursWithPass : config.stadium.capHours))
  const cost = level < levels ? config.stadium.upgradeCost[level - 1] : null
  const collect = useGameAction(() => gameApi.collectStadium())
  const upgrade = useGameAction(() => gameApi.upgradeStadium())
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  return (
    <section className="flex flex-col items-center gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Stadium">
      <img src={art(`club/stadium_lv${stadiumStage(level)}.png`)} alt="" width={48 * 4} height={28 * 4} className="pixel" />
      <div className="flex w-full flex-col">
        <h2>Stadium</h2>
        <span className="text-muted">{`Level ${level} · ${config.stadium.coinsPerHour[level - 1]} coins an hour`}</span>
      </div>
      <div className="h-3 w-full bg-base-300" role="progressbar" aria-label="Stadium pile" aria-valuenow={pile} aria-valuemin={0} aria-valuemax={cap}>
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (pile / cap) * 100)}%` }} />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary min-h-11" disabled={pile < 1 || collect.isPending} onClick={() => collect.mutate(undefined, { onError })}>
          <Icon path="icons/currency_coin.png" />
          {` Collect ${pile.toLocaleString('en-GB')}`}
        </button>
        <button type="button" className="btn btn-outline min-h-11" disabled={cost === null || state.coins + pile < cost || upgrade.isPending} onClick={() => upgrade.mutate(undefined, { onError })}>
          {cost === null ? 'Top level' : `Upgrade · ${cost.toLocaleString('en-GB')}`}
        </button>
      </div>
      <span className="text-muted">{`Holds ${cap.toLocaleString('en-GB')} coins. Upgrades at levels 4 and 8 build bigger stands.`}</span>
    </section>
  )
}

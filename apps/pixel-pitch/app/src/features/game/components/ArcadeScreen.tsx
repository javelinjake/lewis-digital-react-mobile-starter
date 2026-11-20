import type { GameResponse } from '@ld/pixel-pitch-core'
import { energyAt, hotCabinet, keepyMax, pendingTrayTokens } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { Link } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { EnergyBar } from './EnergyBar'
import { Icon } from './sprites'

/** What a perfect play scores in each game, for "best 9 / 15". */
const topScore = (cabinet: string, keepy: number) => (cabinet === 'keepy' ? keepy : 15)

/** The arcade: one energy bar for every game, one token tray, and a game of the day that pays extra. */
export function ArcadeScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const now = useServerNow(game)
  const collect = useGameAction(() => gameApi.collectTray())
  const tray = pendingTrayTokens(state.idle, config, now)
  const trayHours = state.idle.hasPass ? config.cabinets.trayCapHoursWithPass : config.cabinets.trayCapHours
  const hot = hotCabinet(now, config)
  const hasEnergy = energyAt(state, config, now) >= 1
  const bonus = Math.round(config.cabinets.hotBonus * 100)

  return (
    <div className="flex flex-col gap-4">
      <EnergyBar game={game} />

      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Token tray">
        <div className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-1">
            <Icon path="icons/currency_token.png" label="Tokens" />
            <span>{`Tray: ${tray} tokens`}</span>
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm min-h-11"
            disabled={tray < 1 || collect.isPending}
            onClick={() => collect.mutate(undefined, { onError: error => toast.push(formatError(error), 'error') })}
          >
            Collect
          </button>
        </div>
        <span className="text-muted">{`The tray fills while you are away and holds ${trayHours} hours of tokens. You have ${state.tokens}. Tokens buy Arcade packs.`}</span>
      </section>

      {CABINETS.map(({ cabinet, name, blurb }) => {
        const best = state.arcade.best[cabinet]
        const isHot = cabinet === hot
        return (
          <section key={cabinet} className={`flex flex-col gap-2 border-2 bg-base-100 p-3 ${isHot ? 'border-warning' : 'border-slate'}`} aria-label={name}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-primary">{name}</h2>
              {isHot ? <span className="bg-warning px-2 text-warning-content">{`Today +${bonus}% tokens`}</span> : null}
            </div>
            <span className="text-muted">{blurb}</span>
            <span className="text-lg tabular-nums">{best > 0 ? `Best: ${best} / ${topScore(cabinet, keepyMax(config))}` : 'Not played yet'}</span>
            {hasEnergy
              ? <Link to={`/arcade/${cabinet}`} className="btn btn-primary min-h-12 font-display text-xs">Play · 1 energy</Link>
              : (
                  <>
                    <Link to={`/arcade/${cabinet}?paid=1`} className="btn btn-outline min-h-12">{`Extra play · ${config.cabinets.gemPlayCost} gems`}</Link>
                    <span className="text-muted">Out of energy. An extra play pays coins and Pass XP, not tokens.</span>
                  </>
                )}
          </section>
        )
      })}
    </div>
  )
}

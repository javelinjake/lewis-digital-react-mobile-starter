import type { Cabinet, GameResponse } from '@ld/pixel-pitch-core'
import { freePlaysLeft, pendingTrayTokens } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { Link } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { Icon } from './sprites'

/** Two cabinets. Each earns tokens in its tray while you are away, and has plays for a burst. */
export function ArcadeScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const now = useServerNow(game)
  const collect = useGameAction((cabinet: Cabinet) => gameApi.collectTray(cabinet))
  const trayHours = state.idle.hasPass ? config.cabinets.trayCapHoursWithPass : config.cabinets.trayCapHours

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center justify-between border-2 border-slate bg-base-100 p-3">
        <span>Tokens buy Arcade packs</span>
        <span className="flex items-center gap-1">
          <Icon path="icons/currency_token.png" label="Tokens" />
          <span className="tabular-nums">{state.tokens}</span>
        </span>
      </section>

      {CABINETS.map(({ cabinet, name, blurb }) => {
        const tray = pendingTrayTokens(state.idle, config, cabinet, now)
        const left = freePlaysLeft(state, cabinet, config, now)
        return (
          <section key={cabinet} className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label={name}>
            <h2 className="text-primary">{name}</h2>
            <span className="text-muted">{blurb}</span>
            <div className="flex items-center justify-between text-lg">
              <span>{`Tray: ${tray} tokens`}</span>
              <button
                type="button"
                className="btn btn-outline btn-sm min-h-11"
                disabled={tray < 1 || collect.isPending}
                onClick={() => collect.mutate(cabinet, { onError: error => toast.push(formatError(error), 'error') })}
              >
                Collect
              </button>
            </div>
            <span className="text-muted">{`Holds ${trayHours} hours of tokens.`}</span>
            {left > 0
              ? <Link to={`/arcade/${cabinet}`} className="btn btn-primary min-h-12 font-display text-xs">{`Play · ${left} free ${left === 1 ? 'play' : 'plays'} left`}</Link>
              : (
                  <>
                    <span className="text-muted">No free plays left today.</span>
                    <Link to={`/arcade/${cabinet}?paid=1`} className="btn btn-outline min-h-12">
                      {`Extra play · ${config.cabinets.gemPlayCost} gems`}
                    </Link>
                    <span className="text-muted">An extra play pays coins and Pass XP, not tokens.</span>
                  </>
                )}
          </section>
        )
      })}
    </div>
  )
}

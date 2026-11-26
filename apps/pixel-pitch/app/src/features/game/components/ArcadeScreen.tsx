import type { Cabinet, GameResponse } from '@ld/pixel-pitch-core'
import type { CabinetInfo } from '../lib/cabinets'
import { energyAt, hotCabinet, pendingTrayTokens } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { Link } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS, topScore } from '../lib/cabinets'
import { kitOf } from '../lib/club'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { CabinetArt } from './CabinetArt'
import { EnergyBar } from './EnergyBar'
import { Icon } from './sprites'

/** One game in the arcade: a strip of grass with a picture of the game and its best score, its name and line, and Play. */
function CabinetCard({ info, kit, best, max, hot, bonus, hasEnergy, gemCost, wide }: {
  info: CabinetInfo
  kit: readonly [string, string]
  best: number
  max: number
  hot: boolean
  bonus: number
  hasEnergy: boolean
  gemCost: number
  wide: boolean
}) {
  return (
    <section
      className={`flex flex-col bg-base-100 ${hot ? 'shadow-[inset_0_0_0_3px_var(--color-warning)]' : 'shadow-[inset_0_0_0_2px_var(--color-slate)]'} ${wide ? 'col-span-2' : ''}`}
      aria-label={info.name}
    >
      {/* The picture sits on the grass after the hot badge; the best-score badge is over its top right, kept clear. */}
      <div className={`pp-grass relative flex items-start gap-2 overflow-hidden border-b-2 border-slate p-1.5 ${wide ? 'h-16' : 'h-11'}`}>
        {hot ? <span className="shrink-0 bg-warning px-1.5 text-sm text-warning-content">{`Today +${bonus}% tokens`}</span> : null}
        <CabinetArt cabinet={info.cabinet} kit={kit} scale={wide ? 3 : 2} className="-mb-1.5 shrink-0 self-end" />
        <span className="absolute top-1.5 right-1.5 bg-base-200 px-1.5 text-sm text-primary tabular-nums">{best > 0 ? `Best: ${best} / ${max}` : 'Not played yet'}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h2 className="text-primary">{info.name}</h2>
        <span className={`text-sm text-muted ${wide ? '' : 'line-clamp-2'}`}>{info.blurb}</span>
        {hasEnergy
          ? <Link to={`/arcade/${info.cabinet}`} className="btn btn-primary mt-auto min-h-11" aria-label="Play · 1 energy">{wide ? 'Play · 1 energy' : 'Play'}</Link>
          : <Link to={`/arcade/${info.cabinet}?paid=1`} className="btn btn-outline mt-auto min-h-11" aria-label={`Extra play · ${gemCost} gems`}>{`${gemCost} gems`}</Link>}
      </div>
    </section>
  )
}

/**
 * The arcade: one energy bar for every game and one token tray at the top, then the games. Today's game, which pays
 * extra tokens, comes first and wide; the rest sit two to a row.
 */
export function ArcadeScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const now = useServerNow(game)
  const collect = useGameAction(() => gameApi.collectTray())
  const tray = pendingTrayTokens(state.idle, config, now)
  const trayHours = state.idle.hasPass ? config.cabinets.trayCapHoursWithPass : config.cabinets.trayCapHours
  const hot: Cabinet = hotCabinet(now, config)
  const hasEnergy = energyAt(state, config, now) >= 1
  const bonus = Math.round(config.cabinets.hotBonus * 100)
  const ordered = [...CABINETS.filter(info => info.cabinet === hot), ...CABINETS.filter(info => info.cabinet !== hot)]

  return (
    <div className="flex flex-col gap-3">
      <EnergyBar game={game} />

      <section className="flex items-center gap-3 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Token tray">
        <Icon path="icons/currency_token.png" label="Tokens" scale={3} />
        <div className="min-w-0 flex-1">
          <div className="text-lg">{`Tray: ${tray} tokens`}</div>
          <div className="text-sm text-muted">{`You have ${state.tokens}. Fills while you are away, up to ${trayHours}h.`}</div>
        </div>
        <button
          type="button"
          className="btn btn-accent min-h-11 shrink-0 px-4"
          disabled={tray < 1 || collect.isPending}
          onClick={() => collect.mutate(undefined, { onError: error => toast.push(formatError(error), 'error') })}
        >
          Collect
        </button>
      </section>

      {hasEnergy ? null : <span className="text-sm text-muted">Out of energy. An extra play pays coins and Pass XP, not tokens.</span>}

      <div className="grid grid-cols-2 gap-2.5">
        {ordered.map(info => (
          <CabinetCard
            key={info.cabinet}
            info={info}
            kit={kitOf(game)}
            best={state.arcade.best[info.cabinet]}
            max={topScore(info.cabinet, config)}
            hot={info.cabinet === hot}
            bonus={bonus}
            hasEnergy={hasEnergy}
            gemCost={config.cabinets.gemPlayCost}
            wide={info.cabinet === hot}
          />
        ))}
      </div>
    </div>
  )
}

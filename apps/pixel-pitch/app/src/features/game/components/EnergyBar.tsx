import type { GameResponse } from '@ld/pixel-pitch-core'
import { energyAt, energyMax, nextEnergyAt } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { serverOffset } from '../lib/club'
import { useServerNow } from '../lib/server-clock'
import { useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'

/** The arcade's stamina: one bar for every game, a point back every so often. Counts down to the next point. */
export function EnergyBar({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const now = useServerNow(game)
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const { state } = game.club
  const max = energyMax(state, config)
  const have = energyAt(state, config, now)
  const next = nextEnergyAt(state, config, now)

  return (
    <section className="flex flex-col gap-1.5 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Energy">
      <div className="flex items-baseline justify-between">
        <span className="pp-label">Energy</span>
        <span className="text-lg text-primary tabular-nums">{`${have} / ${max}`}</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${have} of ${max} energy`}>
        {Array.from({ length: max }, (_, index) => (
          <span key={index} className={`h-4 flex-1 ${index < have ? 'bg-primary shadow-[inset_-2px_-2px_0_#c98a00]' : 'bg-base-200 shadow-[inset_0_0_0_2px_var(--color-slate)]'}`} />
        ))}
      </div>
      <span className="text-sm text-muted">
        {next === null
          ? 'Full. Every play costs 1.'
          : (
              <>
                {'Next in '}
                <Countdown to={next} offset={offset} />
                . Every play costs 1.
              </>
            )}
      </span>
    </section>
  )
}

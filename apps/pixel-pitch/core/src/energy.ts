import type { ClubState } from './club-state'
import type { GameConfig } from './config'
import { GameRuleError } from './errors'

const MINUTE = 60_000

/** The arcade's stamina: one shared bar for every cabinet. Each play spends one; one comes back every so often. */
export function energyMax(state: Pick<ClubState, 'idle'>, config: Pick<GameConfig, 'cabinets'>) {
  const { max, maxWithPass } = config.cabinets.energy
  return state.idle.hasPass ? maxWithPass : max
}

const regenMs = (config: Pick<GameConfig, 'cabinets'>) => config.cabinets.energy.regenMinutes * MINUTE

/**
 * Energy now. Only the time at which the bar will be full again is stored, never a counter, so it refills on the
 * server's clock whether or not anyone is looking, and gaining the Pass raises the ceiling at once.
 */
export function energyAt(state: Pick<ClubState, 'energy' | 'idle'>, config: Pick<GameConfig, 'cabinets'>, now: number) {
  const missing = Math.ceil(Math.max(0, state.energy.fullAt - now) / regenMs(config))
  return Math.max(0, energyMax(state, config) - missing)
}

/** When the next point of energy arrives, or null when the bar is full. */
export function nextEnergyAt(state: Pick<ClubState, 'energy' | 'idle'>, config: Pick<GameConfig, 'cabinets'>, now: number): number | null {
  if (state.energy.fullAt <= now)
    return null
  const missing = Math.ceil((state.energy.fullAt - now) / regenMs(config))
  // Anything above the ceiling (the Pass ran out) is not worth waiting for.
  if (missing > energyMax(state, config))
    return state.energy.fullAt - energyMax(state, config) * regenMs(config)
  return state.energy.fullAt - (missing - 1) * regenMs(config)
}

/** Spends one point. Refuses when there is none. */
export function spendEnergy(state: ClubState, config: Pick<GameConfig, 'cabinets'>, now: number): ClubState {
  if (energyAt(state, config, now) < 1)
    throw new GameRuleError('no-energy', 'Out of energy. It comes back a little at a time, or use gems for an extra play.')
  return { ...state, energy: { fullAt: Math.max(state.energy.fullAt, now) + regenMs(config) } }
}

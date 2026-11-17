import type RAPIER from '@dimforge/rapier3d-compat'

export type Rapier = typeof RAPIER

let loading: Promise<Rapier> | null = null

/** Loads the WASM physics engine once. The import is lazy so the garage and builder start without it. */
export function loadRapier(): Promise<Rapier> {
  loading ??= import('@dimforge/rapier3d-compat').then(async (mod) => {
    await mod.default.init()
    return mod.default
  })
  return loading
}

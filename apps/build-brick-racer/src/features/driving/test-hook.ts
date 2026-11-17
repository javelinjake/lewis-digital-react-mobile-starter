import type { DriveEngine } from './engine/drive-engine'
import { defaultContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { getRepo } from '@/lib/platform/repo'
import { useSessionStore } from '@/stores/session.store'

/** Development-only hook so Playwright can seed a car and read telemetry. Never present in production builds. */
interface BrickTestHook {
  seedStarter: (kind: 'racer' | 'buggy') => Promise<string>
  telemetry: () => ReturnType<DriveEngine['telemetry']> | null
  lastRunId: () => string | null
}

declare global {
  interface Window {
    __brickTest?: BrickTestHook
  }
}

let current: DriveEngine | null = null

export function registerEngine(engine: DriveEngine | null): void {
  current = engine
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__brickTest = {
    async seedStarter(kind) {
      const doc = buildStarter(kind, defaultContext)
      await getRepo().saveCar(doc)
      return doc.carId
    },
    telemetry: () => current?.telemetry() ?? null,
    lastRunId: () => useSessionStore.getState().lastRunId,
  }
}

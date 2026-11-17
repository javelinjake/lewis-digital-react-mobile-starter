/**
 * Development-only test hook (never present in production builds). It lets end-to-end tests seed cars through
 * the app's own garage store and read editor state and snap-ring screen positions. It cannot change a car.
 */
import type { NewCarKind } from '@/stores/garage.store'
import { useEditorStore } from '@/stores/editor.store'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'

export interface RingInfo {
  x: number
  y: number
  key: string
  kind: string
}

interface BuilderTestHook {
  seed: (kind: NewCarKind) => Promise<string | null>
  state: () => {
    instances: number
    ids: string[]
    defs: string[]
    selection: string[]
    partId: string | null
    rotation: number
    mode: string
    saveState: string
    issues: string[]
    forward: string | null
    wheelGroups: number
    loose: number
    colourOf: (id: string) => string | null
    revision: string | null
  }
  rings: () => RingInfo[]
  ringCount: () => number
}

declare global {
  interface Window {
    __brickBuilder?: BuilderTestHook
  }
}

let rings: () => RingInfo[] = () => []
let ringCount: () => number = () => 0

export function registerRings(fn: (() => RingInfo[]) | null, count: (() => number) | null): void {
  rings = fn ?? (() => [])
  ringCount = count ?? (() => 0)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__brickBuilder = {
    seed: async kind => (await useGarageStore.getState().create(kind))?.carId ?? null,
    state: () => {
      const e = useEditorStore.getState()
      const doc = e.doc
      return {
        instances: doc?.instances.length ?? 0,
        ids: doc?.instances.map(i => i.id) ?? [],
        defs: doc?.instances.map(i => i.defId) ?? [],
        selection: e.selection,
        partId: e.partId,
        rotation: e.rotation,
        mode: usePrefsStore.getState().prefs.buildMode,
        saveState: e.saveState,
        issues: e.issues.map(i => i.code),
        forward: doc?.forward ?? null,
        wheelGroups: doc?.wheelGroups.length ?? 0,
        loose: 0,
        colourOf: id => doc?.instances.find(i => i.id === id)?.colour ?? null,
        revision: doc?.revisionId ?? null,
      }
    },
    rings: () => rings(),
    ringCount: () => ringCount(),
  }
}

/**
* Test hook for development and explicit end-to-end builds (VITE_E2E=true); never present in normal production builds. It lets end-to-end tests seed cars through
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
    revision: string | null
  }
  rings: () => RingInfo[]
  colourOf: (id: string) => string | null
  /** Fallback when a part is fully hidden from the camera. */
  select: (ids: string[]) => void
  ringCount: () => number
  /** Client point where a tap would pick the part, or null if hidden. */
  partPoint: (id: string) => { x: number, y: number } | null
}

declare global {
  interface Window {
    __brickBuilder?: BuilderTestHook
  }
}

let rings: () => RingInfo[] = () => []
let ringCount: () => number = () => 0
let part: (id: string) => { x: number, y: number } | null = () => null

export function registerRings(fn: (() => RingInfo[]) | null, count: (() => number) | null, partFn: ((id: string) => { x: number, y: number } | null) | null = null): void {
  rings = fn ?? (() => [])
  ringCount = count ?? (() => 0)
  part = partFn ?? (() => null)
}

if ((import.meta.env.DEV || import.meta.env.VITE_E2E === 'true') && typeof window !== 'undefined') {
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
        revision: doc?.revisionId ?? null,
      }
    },
    colourOf: id => useEditorStore.getState().doc?.instances.find(i => i.id === id)?.colour ?? null,
    select: ids => useEditorStore.getState().select(ids),
    rings: () => rings().filter((r) => {
      const el = document.elementFromPoint(r.x, r.y)
      return el?.tagName === 'CANVAS'
    }),
    ringCount: () => ringCount(),
    partPoint: (id) => {
      const p = part(id)
      if (!p)
        return null
      return document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS' ? p : null
    },
  }
}

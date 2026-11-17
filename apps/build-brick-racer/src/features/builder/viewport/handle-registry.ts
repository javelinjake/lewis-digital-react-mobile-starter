import type { RefObject } from 'react'
import type { ViewportHandle } from './ViewportPane'

/** Lets non-viewport code (shortcuts, tests) reach the current viewport handle without prop drilling. */
let current: RefObject<ViewportHandle | null> | null = null

export function registerViewportHandle(ref: RefObject<ViewportHandle | null>): () => void {
  current = ref
  return () => {
    if (current === ref)
      current = null
  }
}

export const viewportHandle = (): ViewportHandle | null => current?.current ?? null

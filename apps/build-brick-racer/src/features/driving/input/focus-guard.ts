import type { ControlHub } from './hub'

/**
 * Losing focus for any reason (window blur, hidden tab, page hide, orientation change) clears every held
 * input, so a finger that never sent a "release" cannot leave the car driving by itself.
 * Returns a function that removes the listeners.
 */
export function attachFocusGuard(hub: ControlHub, win: Window = window, doc: Document = document): () => void {
  const release = () => hub.releaseAll()
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden')
      release()
  }
  win.addEventListener('blur', release)
  win.addEventListener('pagehide', release)
  doc.addEventListener('visibilitychange', onVisibility)
  return () => {
    win.removeEventListener('blur', release)
    win.removeEventListener('pagehide', release)
    doc.removeEventListener('visibilitychange', onVisibility)
  }
}

import type { CarDocument } from '@/game/build/types'
import type { DriveAssessment } from '@/game/vehicle/analysis'
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeAssemblies, looseInstanceIds } from '@/game/build/assemblies'
import { catalog } from '@/game/catalog/catalog'
import { assessDrive } from '@/game/vehicle/analysis'
import { usePrefsStore } from '@/stores/prefs.store'

export type LayoutKind = 'bottom' | 'rail'

const measure = (): LayoutKind => (typeof window !== 'undefined' && window.innerWidth >= 1000 && window.innerHeight >= 600 ? 'rail' : 'bottom')

/** Tablets get a left parts rail; phones get a bottom tray. */
export function useLayoutKind(): LayoutKind {
  const [kind, setKind] = useState<LayoutKind>(measure)
  useEffect(() => {
    const on = () => setKind(measure())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return kind
}

/** Instance ids that are not in the main driving assembly. Recomputed per document revision. */
export function useLooseIds(doc: CarDocument | null): ReadonlySet<string> {
  return useMemo(() => (doc ? looseInstanceIds(computeAssemblies(doc, catalog)) : new Set<string>()), [doc?.revisionId, doc?.carId]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Drive assessment, deferred so heavy compilation never runs during a placement. The previous result stays
 * visible while a new one is computed.
 */
export function useAssessment(doc: CarDocument | null, delayMs = 350): DriveAssessment | null {
  const [result, setResult] = useState<DriveAssessment | null>(null)
  const docRef = useRef(doc)
  docRef.current = doc
  useEffect(() => {
    if (!docRef.current)
      return
    const timer = setTimeout(() => {
      const d = docRef.current
      if (d)
        setResult(assessDrive(d, catalog))
    }, delayMs)
    return () => clearTimeout(timer)
  }, [doc?.revisionId, doc?.carId, delayMs])
  return result
}

export const TUTORIAL_STEPS = ['build-brick', 'build-place', 'build-colour'] as const
export type TutorialStep = (typeof TUTORIAL_STEPS)[number]

/** The one coach mark to show now (Easy Build, first time), or null when finished or dismissed. */
export function currentTutorialStep(completed: readonly string[], dismissed: boolean, mode: 'easy' | 'free'): TutorialStep | null {
  if (dismissed || mode !== 'easy')
    return null
  return TUTORIAL_STEPS.find(s => !completed.includes(s)) ?? null
}

export function useTutorialStep(mode: 'easy' | 'free'): TutorialStep | null {
  const t = usePrefsStore(s => s.prefs.tutorial)
  return currentTutorialStep(t.completed, t.dismissed, mode)
}

export interface ShortcutHandlers {
  undo: () => void
  redo: () => void
  remove: () => void
  rotate: () => void
  escape: () => void
}

/** Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z (or Ctrl+Y), Delete, R and Escape. Ignored while typing in a field. */
export function useBuilderShortcuts(h: ShortcutHandlers): void {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
        return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey)
          ref.current.redo()
        else
          ref.current.undo()
      }
      else if (mod && key === 'y') {
        e.preventDefault()
        ref.current.redo()
      }
      else if (!mod && (key === 'delete' || key === 'backspace')) {
        e.preventDefault()
        ref.current.remove()
      }
      else if (!mod && key === 'r') {
        ref.current.rotate()
      }
      else if (key === 'escape') {
        ref.current.escape()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

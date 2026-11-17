import type { CarDocument } from './types'

/** Undo target. The current build is saved independently of this history. */
export const UNDO_LIMIT = 200

export interface HistoryEntry {
  label: string
  doc: CarDocument
}

export interface History {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

export const emptyHistory = (): History => ({ past: [], future: [] })

/** Record the document that was current BEFORE a committed edit. One call is one undo step. */
export function pushHistory(history: History, before: CarDocument, label: string): History {
  const past = [...history.past, { label, doc: before }]
  return { past: past.length > UNDO_LIMIT ? past.slice(past.length - UNDO_LIMIT) : past, future: [] }
}

export function undo(history: History, current: CarDocument): { history: History, doc: CarDocument, label: string } | null {
  const entry = history.past[history.past.length - 1]
  if (!entry)
    return null
  return {
    doc: entry.doc,
    label: entry.label,
    history: { past: history.past.slice(0, -1), future: [...history.future, { label: entry.label, doc: current }] },
  }
}

export function redo(history: History, current: CarDocument): { history: History, doc: CarDocument, label: string } | null {
  const entry = history.future[history.future.length - 1]
  if (!entry)
    return null
  return {
    doc: entry.doc,
    label: entry.label,
    history: { past: [...history.past, { label: entry.label, doc: current }], future: history.future.slice(0, -1) },
  }
}

import type { CreateNoteInput, Note } from '../types/note'
import { sleep } from '@ld/utils/async/sleep'

/**
 * In-memory stand-in so the template runs without a CMS.
 * Replace the bodies with Directus calls and keep the signatures.
 * `id` is the client operation id: replay must upsert, not insert again.
 */
let store: Note[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'Notes you add while offline are queued and synced when you reconnect.',
    updatedAt: new Date().toISOString(),
  },
]

let authFailures = 0

function isForcedOffline() {
  return import.meta.env.DEV && sessionStorage.getItem('ld-test-offline') === '1'
}

function assertOnline() {
  if (isForcedOffline() || (typeof navigator !== 'undefined' && !navigator.onLine))
    throw new TypeError('Failed to fetch')
}

export function listServerNoteIds() {
  return store.map(note => note.id)
}

export function resetNotesStore() {
  store = [{
    id: 'welcome',
    title: 'Welcome',
    body: 'Notes you add while offline are queued and synced when you reconnect.',
    updatedAt: new Date().toISOString(),
  }]
  authFailures = 0
}

export async function readNotes(): Promise<Note[]> {
  assertOnline()
  await sleep(40)
  return [...store].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function readNote(id: string): Promise<Note> {
  assertOnline()
  await sleep(20)
  const note = store.find(item => item.id === id)
  if (!note)
    throw Object.assign(new Error('Note not found'), { status: 404 })
  return note
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  assertOnline()
  await sleep(20)

  if (authFailures > 0) {
    authFailures -= 1
    throw Object.assign(new Error('Token expired'), { status: 401 })
  }

  const existing = store.find(item => item.id === input.id)
  if (existing)
    return existing

  const note: Note = { ...input, updatedAt: new Date().toISOString() }
  store.unshift(note)
  return note
}

if (import.meta.env.DEV) {
  window.__ldNotesTest = {
    setOffline(offline: boolean) {
      if (offline)
        sessionStorage.setItem('ld-test-offline', '1')
      else
        sessionStorage.removeItem('ld-test-offline')
    },
    failNextWrite() {
      authFailures += 1
    },
    serverIds() {
      return listServerNoteIds()
    },
  }
}

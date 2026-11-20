import type { CreateNoteInput, Note } from '../types/note'
import { sleep } from '@ld/utils/async/sleep'

/**
 * In-memory stand-in for the api app (`VITE_DATA_MODE=mock`), so the template runs with nothing else started and
 * tests are hermetic. `notes.live.ts` has the same signatures. `id` is the client operation id: a replay must
 * upsert, not insert again.
 */
const STORE_KEY = 'ld-mock-notes'

let store: Note[] = []

function welcomeNotes(): Note[] {
  return [{
    id: 'welcome',
    title: 'Welcome',
    body: 'Notes you add while offline are queued and synced when you reconnect.',
    updatedAt: new Date().toISOString(),
  }]
}

// The mock "server" keeps its notes in the tab's session storage, so a write that landed before a page reload is
// still there afterwards, like it would be on a real server. Without this, a reload silently erased delivered notes.
function loadStore(): Note[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) as Note[] : welcomeNotes()
  }
  catch {
    return welcomeNotes()
  }
}

function saveStore() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(store))
  }
  catch {
    // Session storage can be unavailable (private mode). The in-memory copy still works.
  }
}

store = loadStore()

let authFailures = 0
// While true, every write is refused with 401, like a server whose session for this device has expired. It lasts until
// the page reloads, which is what signing in again does. A one-shot failure would let two overlapping sends of the
// same note split the 401 between them, and one of them would get through.
let sessionExpired = false

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
  store = welcomeNotes()
  saveStore()
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

  if (sessionExpired || authFailures > 0) {
    authFailures = Math.max(0, authFailures - 1)
    throw Object.assign(new Error('Token expired'), { status: 401 })
  }

  const existing = store.find(item => item.id === input.id)
  if (existing)
    return existing

  const note: Note = { ...input, updatedAt: new Date().toISOString() }
  store.unshift(note)
  saveStore()
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
    expireSession() {
      sessionExpired = true
    },
  }
}

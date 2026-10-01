export interface FamilyMember {
  id: string
  name: string
  role: 'adult' | 'child'
}

export interface JournalEntry {
  date: string
  body: string
}

export interface FamilyState {
  familyName: string
  members: FamilyMember[]
  journal: JournalEntry[]
  checks: Record<string, string[]>
  preferences: { captions: boolean, keepAwake: boolean, reminders: boolean }
  feelings: Record<string, string>
}

const listeners = new Map<string, Set<() => void>>()
const memory = new Map<string, FamilyState>()

export function emptyFamilyState(): FamilyState {
  return {
    familyName: '',
    members: [],
    journal: [],
    checks: {},
    preferences: { captions: false, keepAwake: true, reminders: false },
    feelings: {},
  }
}

function storageKey(userId: string) {
  return `zactiv-family:${userId}`
}

export function readFamilyState(userId: string): FamilyState {
  const cached = memory.get(userId)
  if (cached)
    return cached

  if (typeof window === 'undefined') {
    const empty = emptyFamilyState()
    memory.set(userId, empty)
    return empty
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    const parsed = raw ? { ...emptyFamilyState(), ...JSON.parse(raw) } as FamilyState : emptyFamilyState()
    memory.set(userId, parsed)
    return parsed
  }
  catch {
    const empty = emptyFamilyState()
    memory.set(userId, empty)
    return empty
  }
}

export function writeFamilyState(userId: string, next: FamilyState) {
  memory.set(userId, next)
  if (typeof window !== 'undefined')
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next))

  listeners.get(userId)?.forEach(listener => listener())
}

export function updateFamilyState(userId: string, patch: (current: FamilyState) => FamilyState) {
  writeFamilyState(userId, patch(readFamilyState(userId)))
}

export function subscribeFamilyState(userId: string, listener: () => void) {
  const set = listeners.get(userId) ?? new Set()
  set.add(listener)
  listeners.set(userId, set)
  return () => set.delete(listener)
}

export function journalPrompts() {
  return [
    'What made you smile?',
    'Who made you laugh?',
    'What are you proud of?',
  ]
}

export const ONBOARDING_KEY = 'zactiv_onboarding_complete'
export const PENDING_CREDENTIALS_KEY = 'zactiv_pending_credentials'
export const SCHOOL_SLUG_KEY = 'zactiv_school_slug'

export function hasCompletedOnboarding() {
  return window.localStorage.getItem(ONBOARDING_KEY) === 'true'
}

export function completeOnboarding() {
  window.localStorage.setItem(ONBOARDING_KEY, 'true')
}

export function readPendingCredentials() {
  const raw = window.localStorage.getItem(PENDING_CREDENTIALS_KEY)
  if (!raw)
    return null

  try {
    return JSON.parse(atob(raw)) as { email: string, password: string }
  }
  catch {
    return null
  }
}

export function writePendingCredentials(email: string, password: string) {
  window.localStorage.setItem(PENDING_CREDENTIALS_KEY, btoa(JSON.stringify({ email, password })))
}

export function clearPendingCredentials() {
  window.localStorage.removeItem(PENDING_CREDENTIALS_KEY)
  window.localStorage.removeItem(SCHOOL_SLUG_KEY)
  window.localStorage.removeItem('zactiv_school_id')
}

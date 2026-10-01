import { createItem, readItem, readItems, updateItem } from '@directus/sdk'
import { getDirectus } from '@/lib/directus/client'
import { CollectionNames } from '@/schemas/directus-schema'
import { useAuthStore } from '@/stores/auth.store'

const STORAGE_KEY = 'zactiv_logs_active'
const SESSION_ID_KEY = 'zactiv_session_id'

export type ActivityStatus = 'started' | 'completed' | null

export interface ActiveLog {
  logId: number
  startTime: string
  itemId: number
  itemType: 'workout' | 'video' | 'recipe'
}

type ActiveLogs = Record<string, ActiveLog>

function keyFor(itemType: ActiveLog['itemType'], itemId: number) {
  return `${itemType}:${itemId}`
}

export function readActiveLogs(): ActiveLogs {
  if (typeof window === 'undefined')
    return {}

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as ActiveLogs
  }
  catch {
    return {}
  }
}

export function getActiveLog(itemType: ActiveLog['itemType'], itemId: number) {
  return readActiveLogs()[keyFor(itemType, itemId)] ?? null
}

export function latestActiveLog() {
  return Object.values(readActiveLogs()).sort((a, b) => b.startTime.localeCompare(a.startTime))[0] ?? null
}

export function writeActiveLog(entry: ActiveLog) {
  const next = { ...readActiveLogs(), [keyFor(entry.itemType, entry.itemId)]: entry }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearActiveLog(itemType: ActiveLog['itemType'], itemId: number) {
  const next = readActiveLogs()
  delete next[keyFor(itemType, itemId)]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearAllActiveLogs() {
  window.localStorage.removeItem(STORAGE_KEY)
}

function collectionFor(itemType: ActiveLog['itemType']) {
  if (itemType === 'workout')
    return CollectionNames.workouts
  if (itemType === 'recipe')
    return CollectionNames.recipes
  return CollectionNames.videos
}

function getOrCreateSessionId() {
  if (typeof window === 'undefined')
    return ''

  try {
    let sessionId = window.sessionStorage.getItem(SESSION_ID_KEY)
    if (!sessionId) {
      sessionId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionId)
    }
    return sessionId
  }
  catch {
    return ''
  }
}

function logMetadata(eventTrigger = 'user_action') {
  if (typeof window === 'undefined')
    return {}

  return {
    platform: 'web',
    source_client: 'family_app',
    app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    userAgent: navigator.userAgent,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      dpr: window.devicePixelRatio || 1,
    },
    locale: navigator.language || 'en',
    timezoneOffset: new Date().getTimezoneOffset(),
    session_id: getOrCreateSessionId(),
    event_trigger: eventTrigger,
    timestamp: new Date().toISOString(),
  }
}

export async function checkLogExists(logId: number) {
  try {
    const log = await getDirectus().request(readItem(CollectionNames.logs, String(logId), {
      fields: ['id', 'completed'],
    }))
    return Boolean(log && !log.completed)
  }
  catch {
    return false
  }
}

export async function validateStoredLog(itemType: ActiveLog['itemType'], itemId: number) {
  const active = getActiveLog(itemType, itemId)
  if (!active)
    return

  const exists = await checkLogExists(active.logId)
  if (!exists)
    clearActiveLog(itemType, itemId)
}

export async function createActivityLog(userId: string, itemType: ActiveLog['itemType'], itemId: number) {
  const started = new Date().toISOString()
  const log = await getDirectus().request(createItem(CollectionNames.logs, {
    user: userId,
    event_category: itemType,
    started,
    platform: 'web',
    app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    metadata: logMetadata('user_action'),
  } as never))

  const logId = Number(log?.id)
  if (!logId)
    return null

  await getDirectus().request(createItem(CollectionNames.logs_event, {
    logs_id: logId,
    item: itemId,
    collection: collectionFor(itemType),
  } as never)).catch(() => null)

  const entry: ActiveLog = {
    logId,
    itemId,
    itemType,
    startTime: started,
  }
  writeActiveLog(entry)
  return entry
}

export async function ensureActivityLog(userId: string, itemType: ActiveLog['itemType'], itemId: number) {
  const existing = getActiveLog(itemType, itemId)
  if (existing)
    return existing

  return createActivityLog(userId, itemType, itemId)
}

export async function finishItemActivity(
  itemType: ActiveLog['itemType'],
  itemId: number,
  durationOverride?: number,
) {
  const active = getActiveLog(itemType, itemId)
  if (!active)
    return false

  const duration = durationOverride ?? Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000)
  const ok = await completeActivityLog(active.logId, duration)
  if (ok)
    clearActiveLog(itemType, itemId)

  return ok
}

export async function saveActivityNote(logId: number, note: string) {
  if (!note.trim())
    return

  await getDirectus().request(updateItem(CollectionNames.logs, String(logId), { note } as never))
}

export async function completeActivityLog(logId: number, duration: number, note?: string) {
  try {
    const current = await getDirectus().request(readItem(CollectionNames.logs, String(logId), {
      fields: ['id', 'completed', 'note'],
    }))
    if (!current || current.completed)
      return false

    await getDirectus().request(updateItem(CollectionNames.logs, String(logId), {
      completed: new Date().toISOString(),
      duration,
      note: note || current.note,
    } as never))
    return true
  }
  catch {
    return false
  }
}

export async function getActivityStatus(
  itemType: ActiveLog['itemType'],
  itemId: number,
): Promise<ActivityStatus> {
  const userId = useAuthStore.getState().user?.id
  if (!userId)
    return null

  try {
    const logsEvents = await getDirectus().request(readItems(CollectionNames.logs_event, {
      filter: {
        item: { _eq: itemId },
        collection: { _eq: collectionFor(itemType) },
      },
      fields: ['logs_id'],
    }))

    if (!logsEvents?.length)
      return null

    const logIds = (logsEvents as { logs_id?: unknown }[])
      .map((event) => {
        const raw = event.logs_id
        if (typeof raw === 'object' && raw !== null && 'id' in raw)
          return Number((raw as { id: unknown }).id)
        return Number(raw)
      })
      .filter(id => Number.isFinite(id))

    if (!logIds.length)
      return null

    const logs = await getDirectus().request(readItems(CollectionNames.logs, {
      filter: {
        user: { _eq: userId },
        event_category: { _eq: itemType },
        id: { _in: logIds },
      },
      fields: ['id', 'started', 'completed', 'abandoned'],
      sort: ['-started'],
      limit: 1,
    }))

    const log = logs?.[0]
    if (!log || log.abandoned)
      return null
    if (log.completed)
      return 'completed'
    if (log.started)
      return 'started'
    return null
  }
  catch {
    return null
  }
}

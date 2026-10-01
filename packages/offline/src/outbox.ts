import type { AsyncStorage } from './storage'
import { OUTBOX_STORAGE_VERSION } from './scope'

export interface OutboxItem<TPayload = unknown> {
  /** Stable operation id supplied by the caller. Replay is idempotent on this id. */
  id: string
  type: string
  payload: TPayload
  userId: string
  projectId: string
  createdAt: number
  attempts: number
  lastError?: string
  /** Set when the server rejected the session. The item stays with this user. */
  hold?: 'auth'
}

interface StoredOutbox {
  version: number
  items: OutboxItem[]
}

export interface OutboxSnapshot {
  items: OutboxItem[]
  isFlushing: boolean
}

export type OutboxHandler<TPayload = unknown> = (payload: TPayload, item: OutboxItem<TPayload>) => Promise<void>

export interface OutboxOptions {
  storage: AsyncStorage
  /** Already scoped, from `scopeStorageKey('outbox', projectId, userId)`. */
  storageKey: string
  userId: string
  projectId: string
  isOnline?: () => boolean
  maxAttempts?: number
  isRetryable?: (error: unknown) => boolean
  isAuthError?: (error: unknown) => boolean
  onDrop?: (item: OutboxItem, error: unknown) => void
  onAuthHold?: (item: OutboxItem, error: unknown) => void
}

export function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof TypeError)
    return true

  const status = readStatus(error)
  return status >= 500 || status === 429 || status === 408
}

export function defaultIsAuthError(error: unknown): boolean {
  return readStatus(error) === 401
}

function readStatus(error: unknown): number {
  if (!error || typeof error !== 'object')
    return 0

  const status = (error as { status?: number }).status
  return typeof status === 'number' ? status : 0
}

export function createOutbox(options: OutboxOptions) {
  const {
    storage,
    storageKey,
    userId,
    projectId,
    isOnline,
    maxAttempts = 5,
    isRetryable = defaultIsRetryable,
    isAuthError = defaultIsAuthError,
    onDrop,
    onAuthHold,
  } = options

  let items: OutboxItem[] = []
  let isFlushing = false
  let snapshot: OutboxSnapshot = { items, isFlushing }
  const handlers = new Map<string, OutboxHandler>()
  const listeners = new Set<() => void>()
  const syncedListeners = new Set<(item: OutboxItem) => void>()

  function publish() {
    snapshot = { items, isFlushing }
    listeners.forEach(listener => listener())
  }

  async function persist() {
    const stored: StoredOutbox = { version: OUTBOX_STORAGE_VERSION, items: [...items] }
    await storage.set(storageKey, stored)
  }

  const ready = storage.get<StoredOutbox>(storageKey)
    .then(async (stored) => {
      if (!stored)
        return

      if (stored.version !== OUTBOX_STORAGE_VERSION) {
        await storage.set(`${storageKey}:unreadable`, stored)
        await storage.remove(storageKey)
        return
      }

      items = stored.items.filter(item => item.userId === userId && item.projectId === projectId)
      publish()
    })
    .catch(() => {})

  function register<TPayload>(type: string, handler: OutboxHandler<TPayload>) {
    handlers.set(type, handler as OutboxHandler)
  }

  async function enqueue<TPayload>(type: string, payload: TPayload, id: string): Promise<OutboxItem<TPayload>> {
    await ready

    const existing = items.find(item => item.id === id)
    if (existing)
      return existing as OutboxItem<TPayload>

    const item: OutboxItem<TPayload> = {
      id,
      type,
      payload,
      userId,
      projectId,
      createdAt: Date.now(),
      attempts: 0,
    }

    items = [...items, item]
    await persist()
    publish()
    return item
  }

  async function remove(id: string) {
    items = items.filter(item => item.id !== id)
    await persist()
    publish()
  }

  async function hold(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Session expired'
    let held: OutboxItem | undefined
    items = items.map((item) => {
      if (item.id !== id)
        return item
      held = { ...item, hold: 'auth', lastError: message }
      return held
    })
    await persist()
    publish()
    if (held)
      onAuthHold?.(held, error)
  }

  async function drop(id: string, error: unknown) {
    const item = items.find(entry => entry.id === id)
    if (item)
      onDrop?.(item, error)
    await remove(id)
  }

  async function releaseAuthHolds() {
    await ready
    if (!items.some(item => item.hold === 'auth'))
      return

    items = items.map(item => item.hold === 'auth' ? { ...item, hold: undefined, lastError: undefined } : item)
    await persist()
    publish()
  }

  async function flush(): Promise<void> {
    if (isFlushing)
      return

    isFlushing = true
    publish()

    try {
      await ready

      if (isOnline && !isOnline())
        return

      for (const item of [...items]) {
        if (item.userId !== userId || item.projectId !== projectId || item.hold === 'auth')
          continue

        const handler = handlers.get(item.type)
        if (!handler) {
          onDrop?.(item, new Error(`No outbox handler registered for "${item.type}"`))
          await remove(item.id)
          continue
        }

        try {
          await handler(item.payload, item)
          await remove(item.id)
          syncedListeners.forEach(listener => listener(item))
        }
        catch (error) {
          if (isAuthError(error)) {
            await hold(item.id, error)
            break
          }

          const attempts = item.attempts + 1
          const retry = isRetryable(error) && attempts < maxAttempts

          if (!retry) {
            onDrop?.(item, error)
            await remove(item.id)
            continue
          }

          items = items.map(current => current.id === item.id
            ? { ...current, attempts, lastError: error instanceof Error ? error.message : String(error) }
            : current)
          await persist()
          publish()

          if (isOnline && !isOnline())
            break
        }
      }
    }
    finally {
      isFlushing = false
      publish()
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function onSynced(listener: (item: OutboxItem) => void) {
    syncedListeners.add(listener)
    return () => syncedListeners.delete(listener)
  }

  async function clear() {
    await ready
    items = []
    await persist()
    publish()
  }

  return {
    ready,
    register,
    enqueue,
    remove,
    flush,
    hold,
    drop,
    subscribe,
    onSynced,
    releaseAuthHolds,
    clear,
    getSnapshot: () => snapshot,
    getItems: () => items,
    isAuthError,
    isRetryable,
  }
}

export type Outbox = ReturnType<typeof createOutbox>

/**
 * Persist the operation before attempting it, including while online.
 * `'queued'` means it is durable on this device. Only a confirmed handler
 * success removes it.
 */
export async function runOrQueue<TPayload>(
  outbox: Outbox,
  type: string,
  payload: TPayload,
  operationId: string,
  run: (payload: TPayload) => Promise<unknown>,
): Promise<'sent' | 'queued'> {
  await outbox.enqueue(type, payload, operationId)

  try {
    await run(payload)
    await outbox.remove(operationId)
    return 'sent'
  }
  catch (error) {
    if (outbox.isAuthError(error)) {
      await outbox.hold(operationId, error)
      return 'queued'
    }

    if (!outbox.isRetryable(error)) {
      await outbox.drop(operationId, error)
      throw error
    }

    return 'queued'
  }
}

/**
 * An error response from the backend. `status` is a number so `@ld/offline` can classify it:
 * 401 holds a queued write until the user signs in again, 5xx/429/408 retry, anything else is dropped.
 * A network failure is NOT wrapped. `fetch` throws a `TypeError`, and the outbox treats that as "offline, retry".
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get isUnauthorized() {
    return this.status === 401
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isRetryableStatus(status: number) {
  return status >= 500 || status === 429 || status === 408
}

/** Payload sends `{ errors: [{ message }] }`. Better Auth sends `{ message }` or `{ error }`. */
export function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as { errors?: Array<{ message?: unknown }>, message?: unknown, error?: unknown }
    const first = record.errors?.[0]?.message
    if (typeof first === 'string' && first)
      return first
    if (typeof record.message === 'string' && record.message)
      return record.message
    if (typeof record.error === 'string' && record.error)
      return record.error
  }
  return fallback
}

/** FNV-1a over a string. Detects truncated or interrupted writes; it is not a security measure. */
export function checksum(text: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export interface Sealed<T> {
  checksum: string
  savedAt: string
  /** JSON text of the payload, so the checksum covers exactly what was written. */
  body: string
  /** Typing helper only. */
  readonly __type?: T
}

export function seal<T>(value: T, now = new Date().toISOString()): Sealed<T> {
  const body = JSON.stringify(value)
  return { checksum: checksum(body), savedAt: now, body }
}

/** Returns the payload, or null when the record is damaged. */
export function unseal<T>(sealed: Sealed<T> | undefined | null): T | null {
  if (!sealed || typeof sealed.body !== 'string' || checksum(sealed.body) !== sealed.checksum)
    return null
  try {
    return JSON.parse(sealed.body) as T
  }
  catch {
    return null
  }
}

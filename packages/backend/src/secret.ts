import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

/** Constant-time comparison. An empty expected secret never matches. */
export function secretMatches(provided: string | null | undefined, expected: string | undefined) {
  if (!expected || !provided)
    return false

  return timingSafeEqual(digest(provided), digest(expected))
}

/** Reads `Authorization: Bearer <secret>` or a bare `Authorization: <secret>` header value. */
export function bearerValue(header: string | null | undefined) {
  if (!header)
    return undefined
  return header.replace(/^Bearer\s+/i, '').trim() || undefined
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Plugins report a dismissed sheet or picker as an error; the wording differs per plugin and platform. */
export function isCancellation(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  return /cancel|abort|dismiss/i.test(`${code} ${errorMessage(error)}`)
}

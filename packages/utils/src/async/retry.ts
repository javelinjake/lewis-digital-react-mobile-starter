export interface RetryOptions {
  attempts?: number
  delayMs?: number
  backoff?: number
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3
  const delayMs = options.delayMs ?? 200
  const backoff = options.backoff ?? 2

  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error
      if (attempt < attempts)
        await new Promise(resolve => setTimeout(resolve, delayMs * backoff ** (attempt - 1)))
    }
  }

  throw lastError
}

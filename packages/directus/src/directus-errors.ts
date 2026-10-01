export class DirectusError extends Error {
  readonly status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'DirectusError'
    this.status = status
  }
}

export function normalizeDirectusError(error: unknown): DirectusError {
  if (error instanceof DirectusError)
    return error

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: string
      errors?: Array<{ message?: string }>
      response?: { status?: number }
      status?: number
    }

    const message
      = maybeError.errors?.[0]?.message
        ?? maybeError.message
        ?? 'An unexpected Directus error occurred'

    const status
      = maybeError.response?.status
        ?? maybeError.status
        ?? (maybeError as { statusCode?: number }).statusCode
        ?? 500

    return new DirectusError(message, status)
  }

  if (error instanceof Error)
    return new DirectusError(error.message)

  return new DirectusError('An unexpected error occurred')
}

export function getDirectusErrorMessage(error: unknown): string {
  return normalizeDirectusError(error).message
}

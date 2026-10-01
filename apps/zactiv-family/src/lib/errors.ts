export interface AppError {
  code: string
  userMessage: string
}

const messages: Record<string, string> = {
  ERR_002: 'Invalid email or password. Please try again.',
  ERR_003: 'Your session has expired. Please log in again.',
  ERR_013: 'Invalid query request. Please try again.',
  ERR_999: 'An unexpected error occurred. Please try again.',
}

export function parseError(error: unknown): AppError {
  const record = (typeof error === 'object' && error)
    ? error as {
      message?: string
      status?: number
      statusCode?: number
      extensions?: { code?: string }
      errors?: Array<{ message?: string }>
    }
    : {}
  const message = (record.message || record.errors?.[0]?.message || '').toLowerCase()
  const status = record.status || record.statusCode
  const code = record.extensions?.code

  if (code === 'INVALID_QUERY' || message.includes('invalid query'))
    return { code: 'ERR_013', userMessage: messages.ERR_013 }

  if (status === 401 || message.includes('expired') || message.includes('invalid token'))
    return { code: 'ERR_003', userMessage: messages.ERR_003 }

  if (message.includes('invalid') && message.includes('credential'))
    return { code: 'ERR_002', userMessage: messages.ERR_002 }

  return { code: 'ERR_999', userMessage: record.message || messages.ERR_999 }
}

export function isAuthFailure(error: unknown) {
  const parsed = parseError(error)
  return parsed.code === 'ERR_003'
}

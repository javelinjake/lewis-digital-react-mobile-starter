import { isApiError } from '@ld/api-client'
import { getErrorMessage } from '@ld/utils/errors/get-error-message'

export function formatError(error: unknown) {
  if (isApiError(error))
    return error.message
  if (error instanceof TypeError)
    return 'You appear to be offline. Try again when you have a connection.'

  return getErrorMessage(error)
}

import { DirectusError, getDirectusErrorMessage } from '@ld/directus'
import { getErrorMessage } from '@ld/utils/errors/get-error-message'

export function formatError(error: unknown) {
  if (error instanceof DirectusError)
    return getDirectusErrorMessage(error)

  return getErrorMessage(error)
}

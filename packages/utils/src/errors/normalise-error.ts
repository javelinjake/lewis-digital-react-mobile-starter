import { getErrorMessage } from './get-error-message'

export function normaliseError(error: unknown): string {
  return getErrorMessage(error)
}

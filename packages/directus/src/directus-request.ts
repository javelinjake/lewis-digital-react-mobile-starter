import { normalizeDirectusError } from './directus-errors'

export async function directusRequest<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  }
  catch (error) {
    throw normalizeDirectusError(error)
  }
}

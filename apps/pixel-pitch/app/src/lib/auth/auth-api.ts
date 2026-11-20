import { liveAuthApi } from './auth-api.live'
import { mockAuthApi } from './auth-api.mock'

export type { AuthApi } from './auth-api.types'

// A compile-time constant, so a `live` build drops the mock (and the other way round).
export const authApi = import.meta.env.VITE_DATA_MODE === 'live' ? liveAuthApi : mockAuthApi

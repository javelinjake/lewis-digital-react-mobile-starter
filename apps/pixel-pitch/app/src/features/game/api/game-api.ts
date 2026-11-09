import * as live from './game.live'
import * as mock from './game.mock'

// A compile-time constant, so the build keeps only one of them.
export const gameApi = import.meta.env.VITE_DATA_MODE === 'live' ? live.gameApi : mock.gameApi

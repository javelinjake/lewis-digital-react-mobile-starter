/**
 * Pixel Pitch game rules. Pure TypeScript: no React, Capacitor or Payload, and nothing that reads the clock or a random
 * number on its own. The app uses it for previews and the api for outcomes, so the numbers always match.
 */
export const GAME_ID = 'pixel-pitch'

export { advance, type AdvanceResult, dayIndex, notificationTimes, pendingStadiumCoins, pendingTrayTokens, shelfCapacity } from './advance'
export { DEFAULT_CONFIG, type GameConfig, gameConfigSchema, parseConfig } from './config'
export { type IdleState, newIdleState, type WelcomeBackEvent } from './state'

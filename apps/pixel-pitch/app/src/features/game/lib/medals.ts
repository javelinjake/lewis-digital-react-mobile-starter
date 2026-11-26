import type { Medal } from '@ld/pixel-pitch-core'

export const MEDAL_NAME: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

export const medalName = (medal: Medal) => MEDAL_NAME[medal]

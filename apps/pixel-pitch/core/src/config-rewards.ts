import { z } from 'zod'

/**
 * Something a goal, the calendar, the pass, an album set or a purchase can pay out. `packs` go on the shelf, `starPacks`
 * are guaranteed a Star or better. `signing` lets the player choose one of three named Star players, shown before they
 * choose (never a random roll). `kit` unlocks the premium kit `id`.
 */
export const REWARD_KINDS = ['coins', 'gems', 'tokens', 'packs', 'starPacks', 'signing', 'kit'] as const
export const rewardSchema = z.object({
  kind: z.enum(REWARD_KINDS),
  amount: z.number().int().positive(),
  /** Which kit, for `kit`. */
  id: z.string().optional(),
})
export type Reward = z.infer<typeof rewardSchema>

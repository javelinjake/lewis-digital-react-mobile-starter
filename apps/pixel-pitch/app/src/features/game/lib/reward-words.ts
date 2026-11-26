import type { Reward } from '@ld/pixel-pitch-core'

/** A reward in words, for a toast or a line of text: "600 coins", "a Star pack". */
export function rewardWords(reward: Reward) {
  const one = reward.amount === 1
  if (reward.kind === 'packs')
    return one ? 'a pack' : `${reward.amount} packs`
  if (reward.kind === 'starPacks')
    return one ? 'a Star pack' : `${reward.amount} Star packs`
  return `${reward.amount.toLocaleString('en-GB')} ${reward.kind}`
}

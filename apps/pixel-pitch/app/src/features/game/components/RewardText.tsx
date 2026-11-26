import type { Reward } from '@ld/pixel-pitch-core'
import { Icon } from './sprites'

const ICON: Record<Reward['kind'], string> = {
  coins: 'icons/currency_coin.png',
  gems: 'icons/currency_gem.png',
  tokens: 'icons/currency_token.png',
  packs: 'icons/currency_pack.png',
  starPacks: 'icons/currency_star.png',
}

/** A reward as an icon and an amount: "🪙 600", "1 Star pack". `compact` stacks them for a narrow cell. */
export function RewardText({ reward, compact = false }: { reward: Reward, compact?: boolean }) {
  const label = reward.kind === 'packs' ? (reward.amount === 1 ? 'pack' : 'packs') : reward.kind === 'starPacks' ? (reward.amount === 1 ? 'Star pack' : 'Star packs') : reward.kind
  // In a narrow cell (the login streak): the icon over a short amount.
  if (compact) {
    const short = reward.kind === 'packs' ? 'Pack' : reward.kind === 'starPacks' ? 'Star' : reward.amount.toLocaleString('en-GB')
    return (
      <span className="flex flex-col items-center">
        <Icon path={ICON[reward.kind]} label={label} />
        <span className="tabular-nums">{short}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Icon path={ICON[reward.kind]} label={label} />
      <span className="tabular-nums">{reward.kind === 'packs' || reward.kind === 'starPacks' ? `${reward.amount} ${label}` : reward.amount.toLocaleString('en-GB')}</span>
    </span>
  )
}

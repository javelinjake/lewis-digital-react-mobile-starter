import type { Reward } from '@ld/pixel-pitch-core'
import { useGameConfig } from '../queries/use-game'
import { Icon } from './sprites'

const ICON: Record<Reward['kind'], string> = {
  coins: 'icons/currency_coin.png',
  gems: 'icons/currency_gem.png',
  tokens: 'icons/currency_token.png',
  packs: 'icons/currency_pack.png',
  starPacks: 'icons/currency_star.png',
  signing: 'icons/currency_star.png',
  kit: 'icons/ui_club.png',
}

/** A reward as an icon and an amount: "🪙 600", "a Star pack". */
export function RewardText({ reward }: { reward: Reward }) {
  const config = useGameConfig()
  if (reward.kind === 'signing' || reward.kind === 'kit') {
    const text = reward.kind === 'signing'
      ? (reward.amount === 1 ? 'Star Signing' : `${reward.amount} Star Signings`)
      : `${config.cosmetics.kits.find(kit => kit.id === reward.id)?.name ?? 'Premium'} kit`
    return (
      <span className="inline-flex items-center gap-1">
        <Icon path={ICON[reward.kind]} />
        <span>{text}</span>
      </span>
    )
  }
  const label = reward.kind === 'packs' ? (reward.amount === 1 ? 'pack' : 'packs') : reward.kind === 'starPacks' ? (reward.amount === 1 ? 'Star pack' : 'Star packs') : reward.kind
  return (
    <span className="inline-flex items-center gap-1">
      <Icon path={ICON[reward.kind]} label={label} />
      <span className="tabular-nums">{reward.kind === 'packs' || reward.kind === 'starPacks' ? `${reward.amount} ${label}` : reward.amount.toLocaleString('en-GB')}</span>
    </span>
  )
}

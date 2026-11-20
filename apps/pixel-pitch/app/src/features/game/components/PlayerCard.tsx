import type { Player } from '@ld/pixel-pitch-core'
import { NATIONS } from '@ld/pixel-pitch-core'
import { art } from '../lib/art'
import { PlayerSprite } from './sprites'

export type CardTag = 'new' | 'upgrade' | 'dupe' | null

const GLOW: Record<Player['rarity'], string> = {
  grassroots: 'none',
  semipro: 'none',
  pro: 'none',
  star: 'drop-shadow(0 0 6px #f2a33a)',
  legend: 'drop-shadow(0 0 8px #e2483d)',
}

const surname = (name: string) => name.split(' ').at(-1) ?? name

interface PlayerCardProps {
  player: Player
  /** Rating with stars and training. */
  rating: number
  stars?: number
  kit: readonly [string, string]
  /** Pixels per card pixel: 2 is a card 96 wide, 4 is 192. Whole numbers only. */
  scale?: number
  tag?: CardTag
}

/**
 * A player card in the asset pack's frame: portrait window, name, rating, position, nation and ★ pips. Everything is
 * placed in the frame's own pixels (48×64) and multiplied by `scale`, so it stays sharp.
 */
export function PlayerCard({ player, rating, stars = 1, kit, scale = 2, tag = null }: PlayerCardProps) {
  const u = (value: number) => value * scale
  return (
    <div
      className="relative shrink-0"
      style={{ width: u(48), height: u(64), filter: GLOW[player.rarity] }}
      role="img"
      aria-label={`${player.name}, ${player.rarity}, ${player.position}, rated ${rating}, ${stars} ${stars === 1 ? 'star' : 'stars'}${tag ? `, ${tag}` : ''}`}
    >
      <img src={art(`cards/card_${player.rarity}.png`)} alt="" className="pixel absolute inset-0 h-full w-full" />
      <div className="absolute overflow-hidden" style={{ left: u(4), top: u(12), width: u(40), height: u(28) }}>
        <div className="absolute" style={{ left: u(8), top: 0 }}>
          <PlayerSprite player={player} kit={kit} role={player.position} scale={u(2)} />
        </div>
      </div>
      <img src={art(`badges/pos_${player.position.toLowerCase()}.png`)} alt="" className="pixel absolute" style={{ left: u(5), top: u(13), width: u(19), height: u(9) }} />
      <img src={art(`flags/flag_${NATIONS[player.nation].toLowerCase()}.png`)} alt="" className="pixel absolute" style={{ left: u(29), top: u(29), width: u(14), height: u(10) }} />
      <span className="absolute block truncate text-center text-base-content leading-none" style={{ left: u(4), top: u(43), width: u(40), fontSize: u(5.5) }}>{surname(player.name)}</span>
      <span className="absolute block text-center font-display leading-none text-primary" style={{ left: u(4), top: u(49.5), width: u(40), fontSize: u(5) }}>{rating}</span>
      {Array.from({ length: 5 }, (_, pip) => (
        <span key={pip} className="absolute block" style={{ left: u(5 + pip * 4), top: u(57), width: u(2), height: u(2), background: pip < stars ? '#ffd23f' : '#3a3f72' }} />
      ))}
      {tag ? <img src={art(`badges/tag_${tag}.png`)} alt="" className="pixel absolute" style={{ right: u(-2), top: u(-3), width: u(tag === 'upgrade' ? 33 : tag === 'new' ? 19 : 21), height: u(9) }} /> : null}
    </div>
  )
}

/** A card turned face down. */
export function CardBack({ scale = 2 }: { scale?: number }) {
  return <img src={art('cards/card_back.png')} alt="Face-down card" width={48 * scale} height={64 * scale} className="pixel shrink-0" />
}

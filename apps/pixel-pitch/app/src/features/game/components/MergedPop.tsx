import type { OwnedCard, Player } from '@ld/pixel-pitch-core'
import { sellValue, toFielded } from '@ld/pixel-pitch-core'
import { useReducedEffects } from '@ld/react-utils'
import { useGameConfig } from '../queries/use-game'
import { PlayerCard } from './PlayerCard'

export interface MergeOutcome {
  player: Player
  /** The best of the copies that went in (most trained), as it was. */
  before: OwnedCard
  /** The card that came out. */
  after: OwnedCard
  copies: number
  inLineup: boolean
}

/** One line of what changed: a label, before → after, and the gain when there is one. */
function Change({ label, from, to, gain }: { label: string, from: string, to: string, gain?: string }) {
  return (
    <li className="flex items-baseline gap-2 border-t-2 border-slate py-1.5 first:border-t-0">
      <span className="flex-1 text-muted">{label}</span>
      <span className="tabular-nums">{from}</span>
      <span className="text-muted" aria-hidden="true">→</span>
      <span className="sr-only">to</span>
      <span className="text-primary tabular-nums">{to}</span>
      {gain ? <span className="w-12 text-right text-success tabular-nums">{gain}</span> : <span className="w-12" />}
    </li>
  )
}

/**
 * What a merge did, so the player is not left wondering where their three cards went: the new card, a star higher,
 * and each thing that changed, before and after.
 */
export function MergedPop({ outcome, kit, onClose }: { outcome: MergeOutcome, kit: readonly [string, string], onClose: () => void }) {
  const config = useGameConfig()
  const reduced = useReducedEffects()
  const { player, before, after, copies, inLineup } = outcome
  const ratingBefore = toFielded(before, player, config).rating
  const ratingAfter = toFielded(after, player, config).rating
  const valueBefore = sellValue(before, player, config)
  const valueAfter = sellValue(after, player, config)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Merged">
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-y-auto bg-base-100 p-5 shadow-[inset_0_0_0_3px_var(--color-primary)]" style={{ animation: reduced ? undefined : 'pp-card-in 280ms cubic-bezier(.2,.8,.2,1)' }}>
        <h2 className="text-2xl text-primary">Merged!</h2>
        <PlayerCard player={player} rating={ratingAfter} stars={after.stars} kit={kit} scale={3} />
        <span className="text-center">{`${copies} copies of ${player.name} are now one card, a star higher.`}</span>
        <ul className="w-full" aria-label="What changed">
          <Change label="Stars" from={'★'.repeat(before.stars)} to={'★'.repeat(after.stars)} />
          <Change label="Rating" from={String(ratingBefore)} to={String(ratingAfter)} gain={ratingAfter > ratingBefore ? `+${ratingAfter - ratingBefore}` : undefined} />
          <Change label="Training" from={`+${before.trained}`} to={`+${after.trained}`} />
          <Change label="Sells for" from={valueBefore.toLocaleString('en-GB')} to={valueAfter.toLocaleString('en-GB')} gain={valueAfter > valueBefore ? `×${Math.round(valueAfter / valueBefore)}` : undefined} />
          <Change label="Squad places" from={String(copies)} to="1" gain={`${copies - 1} free`} />
        </ul>
        {after.trained > 0 ? <span className="text-center text-sm text-muted">The best training of the copies is kept.</span> : null}
        {inLineup ? <span className="text-center text-sm text-success">Still in your lineup, in the same place.</span> : null}
        <button type="button" className="btn btn-primary h-12 w-full" onClick={onClose}>Nice</button>
      </div>
    </div>
  )
}

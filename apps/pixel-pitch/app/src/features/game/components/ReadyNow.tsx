import type { GameResponse } from '@ld/pixel-pitch-core'
import { Link } from 'react-router'
import { claimCount, readyItems } from '../lib/ready-now'
import { useCatalogue, useGameConfig } from '../queries/use-game'

/**
 * Rewards waiting to be claimed, in one bar with one button that takes them all. Each reward goes to the screen it
 * came from. Nothing to claim, no bar: the tiles and the match card say what is coming.
 */
export function ReadyNow({ game, claim, pending }: { game: GameResponse, claim: () => void, pending: boolean }) {
  const config = useGameConfig()
  const { data: catalogue } = useCatalogue()
  const items = readyItems(game, config, catalogue ?? []).filter(item => item.claim)
  const claims = claimCount(items)
  if (claims === 0)
    return null

  return (
    <section className="flex flex-col gap-2 border-2 border-primary bg-base-100 p-3" aria-label="Ready now">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-primary">{claims === 1 ? '1 reward ready' : `${claims} rewards ready`}</h2>
        <button type="button" className="btn btn-primary min-h-11 px-4" disabled={pending} onClick={claim}>{claims === 1 ? 'Claim it' : `Claim all (${claims})`}</button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <li key={item.id}>
            <Link to={item.to} className="flex min-h-9 items-center bg-raised px-2 text-sm shadow-[inset_0_0_0_2px_var(--color-slate-light)]">{item.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

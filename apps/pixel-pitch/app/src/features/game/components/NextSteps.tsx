import type { ReadyItem } from '../lib/ready-now'
import { Link } from 'react-router'
import { claimCount, readyItems } from '../lib/ready-now'
import { useClaimAll } from '../mutations/use-claim-all'
import { useCatalogue, useClub, useGameConfig } from '../queries/use-game'

/**
 * What to do next, at the end of something: after a match, a play, a pack. One button takes everything waiting, and
 * one goes to the most useful thing to do. `skip` leaves out what the screen already offers (Play again, say).
 */
export function NextSteps({ skip = [] }: { skip?: ReadyItem['id'][] }) {
  const { data: game } = useClub()
  const config = useGameConfig()
  const { data: catalogue } = useCatalogue()
  const { claim, pending, pop } = useClaimAll()
  if (!game)
    return null

  const items = readyItems(game, config, catalogue ?? []).filter(item => !skip.includes(item.id))
  const claims = claimCount(items)
  // The things to go and do (goals and Pass rewards to claim on their screens, packs to open), a few at most.
  const next = items.filter(item => !item.claim).slice(0, 3)
  if (claims === 0 && next.length === 0)
    return pop

  return (
    <section className="flex flex-col gap-2" aria-label="Next steps">
      {claims > 0
        ? <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" disabled={pending} onClick={() => claim()}>{claims === 1 ? 'Claim your reward' : `Claim all (${claims} waiting)`}</button>
        : null}
      {next.map(item => <Link key={item.id} to={item.to} className="btn btn-outline min-h-12 w-full">{`${item.label} ›`}</Link>)}
      {pop}
    </section>
  )
}

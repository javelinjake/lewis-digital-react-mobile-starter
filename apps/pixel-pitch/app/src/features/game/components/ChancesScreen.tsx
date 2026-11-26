import type { Chance } from '@ld/pixel-pitch-core'
import { EmptyState, LoadingState } from '@ld/ui'
import { useState } from 'react'
import { Link } from 'react-router'
import { CHANCE_NAME, chanceStakes } from '../lib/chances'
import { leagueName } from '../lib/club'
import { useClub } from '../queries/use-game'
import { ChancePlay } from './ChancePlay'

/**
 * Big Chances: one playable moment banked from each league match the player missed that ended level or a goal down.
 * They are played in order, the oldest first; each is one try. The rest wait below.
 */
export function ChancesScreen() {
  const club = useClub()
  const game = club.data
  // The chance on screen stays there until the player has seen how it went, though it has left the bank.
  const [held, setHeld] = useState<Chance | null>(null)
  if (!game)
    return club.isPending ? <LoadingState message="Loading your club…" /> : <EmptyState title="No club yet" />

  const { chances, ticket } = game.club.state
  // A moment started and not finished (the app closed mid-kick) comes first: its try is already used.
  const current = held ?? (ticket?.kind === 'chance' && ticket.chance && !ticket.chance.live ? ticket.chance : chances[0])

  if (!current) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState title="No Big Chances waiting" body="A league match you miss that ends level or a goal down banks one. Score it to move the result up." />
        <Link to="/club" className="btn btn-primary min-h-12">Back to the club</Link>
      </div>
    )
  }

  const rest = chances.filter(chance => chance.fixtureNo !== current.fixtureNo)
  return (
    <div className="flex flex-col gap-4">
      <span className="text-muted">{`${held ? rest.length : rest.length + 1} waiting. Scoring one moves that match's result up a step and pays the difference.`}</span>
      <section className="bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-primary)]" aria-label="Big Chance">
        <ChancePlay key={current.fixtureNo} game={game} chance={current} onStart={() => setHeld(current)} onDone={() => setHeld(null)} />
      </section>
      {rest.length > 0
        ? (
            <ul className="flex flex-col gap-2" aria-label="Also waiting">
              {rest.map(chance => (
                <li key={chance.fixtureNo} className="flex flex-col bg-base-100 px-3 py-2 shadow-[inset_0_0_0_2px_var(--color-slate)]">
                  <span className="font-bold">{`${CHANCE_NAME[chance.kind]} · ${leagueName(chance.tier)} match ${chance.fixtureNo + 1}`}</span>
                  <span className="text-sm text-muted">{chanceStakes(chance)}</span>
                </li>
              ))}
            </ul>
          )
        : null}
    </div>
  )
}

import type { GameResponse } from '@ld/pixel-pitch-core'
import { energyAt, nextEnergyAt, notificationTimes } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { serverOffset } from '../lib/club'
import { claimCount, readyItems } from '../lib/ready-now'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'

/** When nothing is ready: what is coming and when, so there is a reason to come back. */
function AllCaughtUp({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const { state } = game.club
  const times = notificationTimes(state.idle, config, game.now)
  const energy = nextEnergyAt(state, config, game.now)
  const upcoming = [
    { label: 'Next match', at: state.league.nextKickoffAt },
    ...(times.shelfFullAt === null ? [] : [{ label: 'Next pack', at: state.idle.shelfClockAt + config.shelf.intervalMinutes * 60_000 }]),
    ...(energy === null || energyAt(state, config, game.now) > 0 ? [] : [{ label: 'Arcade energy', at: energy }]),
    { label: 'Stadium full', at: times.stadiumFullAt },
  ].sort((a, b) => a.at - b.at).slice(0, 3)

  return (
    <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Ready now">
      <h2>All caught up</h2>
      <ul className="flex flex-col gap-1 text-lg">
        {upcoming.map(entry => (
          <li key={entry.label} className="flex items-center justify-between">
            <span className="text-muted">{entry.label}</span>
            <Countdown to={entry.at} offset={offset} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The top of the club hub: everything that is ready, in one place, with a button that takes all of it. Each line goes
 * to the screen that has the detail. With nothing ready, it says what is coming and when.
 */
export function ReadyNow({ game, claim, pending }: { game: GameResponse, claim: () => void, pending: boolean }) {
  const config = useGameConfig()
  const { data: catalogue } = useCatalogue()
  const items = readyItems(game, config, catalogue ?? [])
  const claims = claimCount(items)

  if (items.length === 0)
    return <AllCaughtUp game={game} />

  return (
    <section className="flex flex-col gap-2 border-2 border-primary bg-base-100 p-3" aria-label="Ready now">
      <div className="flex items-center justify-between">
        <h2 className="text-primary">Ready now</h2>
        <span className="min-w-6 bg-secondary px-1 text-center text-secondary-content" aria-label={`${items.length} ready`}>{items.length}</span>
      </div>
      <ul className="flex flex-col">
        {items.map(item => (
          <li key={item.id}>
            <Link to={item.to} className="flex min-h-11 items-center justify-between gap-2 border-b border-base-300 text-lg last:border-b-0">
              <span>{item.label}</span>
              <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
      {claims > 0
        ? <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" disabled={pending} onClick={claim}>{claims === 1 ? 'Claim it' : `Claim all (${claims})`}</button>
        : null}
    </section>
  )
}

import type { GameResponse } from '@ld/pixel-pitch-core'
import { albumSets } from '@ld/pixel-pitch-core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { claimable } from '../lib/claimable'
import { nextRival, serverOffset } from '../lib/club'
import { claimCount, readyItems } from '../lib/ready-now'
import { wasWatched } from '../lib/watched'
import { useClaimAll } from '../mutations/use-claim-all'
import { gameKeys } from '../queries/game.keys'
import { useCatalogue, useFixtures, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
import { FriendlyCard } from './FriendlyCard'
import { ReadyNow } from './ReadyNow'
import { Icon } from './sprites'
import { StadiumCard } from './StadiumCard'
import { WarmupCard } from './WarmupCard'
import { WelcomeBack } from './WelcomeBack'

const SEEN_KEY = 'pp-welcome-seen'

function newsOf(game: GameResponse) {
  return game.events.filter(event => event.type === 'matches' || (event.type === 'packs' && event.gained > 0))
}

/** The home screen: the club, its money, the next match counting down and the last result. */
export function ClubHub({ game }: { game: GameResponse }) {
  const client = useQueryClient()
  const config = useGameConfig()
  const fixtures = useFixtures(1)
  const { state } = game.club
  const rival = nextRival(game, config)
  // Captured when this answer arrived, so the countdown follows the server's clock.
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const last = fixtures.data?.[0]
  const unwatched = last ? !wasWatched(last) : false
  const { data: catalogue } = useCatalogue()
  const waiting = claimable(game, config, albumSets(catalogue ?? [], config))
  const { claim, pending, pop } = useClaimAll()
  const claims = claimCount(readyItems(game, config, catalogue ?? []))

  const [seen, setSeen] = useState(() => Number(sessionStorage.getItem(SEEN_KEY) ?? 0))
  const news = newsOf(game)
  const showWelcome = news.length > 0 && game.now > seen
  useEffect(() => {
    if (!showWelcome)
      sessionStorage.setItem(SEEN_KEY, String(Math.max(seen, game.now)))
  }, [showWelcome, seen, game.now])

  const sync = useCallback(() => {
    void client.invalidateQueries({ queryKey: gameKeys.club() })
  }, [client])

  return (
    <div className="flex flex-col gap-4">
      <ReadyNow game={game} claim={() => claim()} pending={pending} />

      <section className="flex flex-col items-center gap-2 border-2 border-slate bg-base-100 p-4" aria-label="Next match">
        <span className="text-muted">Next match</span>
        <span className="text-xl">{`v ${rival.name}`}</span>
        <span className="font-display text-sm text-primary">
          <Countdown to={state.league.nextKickoffAt} offset={offset} onDone={sync} />
        </span>
        <span className="text-center text-muted">It plays itself at kick-off with the lineup you leave. Meanwhile: play a friendly, warm up, open packs or play the arcade.</span>
        <Link to="/squad" className="btn btn-primary min-h-11 w-full font-display text-xs">Set the lineup</Link>
      </section>

      <FriendlyCard game={game} />
      <WarmupCard game={game} />
      <StadiumCard game={game} />

      <nav className="grid grid-cols-2 gap-2" aria-label="More to do">
        {[
          { to: '/goals', label: 'Goals', note: 'Daily and calendar', icon: 'icons/ui_check.png', count: waiting.goals },
          { to: '/pass', label: 'League Pass', note: 'Season rewards', icon: 'icons/currency_trophy.png', count: waiting.pass },
          { to: '/album', label: 'Album', note: 'Collect sets', icon: 'icons/currency_star.png', count: waiting.album },
        ].map(tile => (
          <Link key={tile.to} to={tile.to} className="relative flex flex-col gap-1 border-2 border-slate bg-base-100 p-3">
            <Icon path={tile.icon} scale={2} />
            <span className="text-xl">{tile.label}</span>
            <span className="text-muted">{tile.note}</span>
            {tile.count > 0 ? <span className="absolute right-2 top-2 min-w-6 bg-secondary px-1 text-center text-secondary-content" aria-label={`${tile.count} to claim`}>{tile.count}</span> : null}
          </Link>
        ))}
      </nav>

      {last
        ? (
            <Link to={`/match/${last.no}`} className={`flex items-center justify-between border-2 bg-base-100 p-3 ${unwatched ? 'border-primary' : 'border-slate'}`}>
              <span className="flex flex-col">
                <span className={unwatched ? 'text-primary' : 'text-muted'}>{unwatched ? 'New result · watch the match ›' : last.no === -1 ? 'First match' : last.no < 0 ? 'Last match: a friendly' : 'Last result · report ›'}</span>
                <span className="text-xl">{`${game.club.name} ${last.goalsFor}–${last.goalsAgainst} ${last.rival.name}`}</span>
              </span>
              <span className={`font-display text-xs ${last.result === 'win' ? 'text-success' : last.result === 'loss' ? 'text-error' : 'text-warning'}`}>
                {last.result.toUpperCase()}
              </span>
            </Link>
          )
        : null}

      {showWelcome
        ? (
            <WelcomeBack
              game={game}
              events={news}
              claims={claims}
              claiming={pending}
              onClaimAll={() => claim(() => {
                sessionStorage.setItem(SEEN_KEY, String(game.now))
                setSeen(game.now)
              })}
              onClose={() => {
                sessionStorage.setItem(SEEN_KEY, String(game.now))
                setSeen(game.now)
              }}
            />
          )
        : null}
      {pop}
    </div>
  )
}

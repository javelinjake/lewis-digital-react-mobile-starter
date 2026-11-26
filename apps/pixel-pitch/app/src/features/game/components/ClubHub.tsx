import type { GameResponse } from '@ld/pixel-pitch-core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { claimCount, readyItems } from '../lib/ready-now'
import { wasWatched } from '../lib/watched'
import { useClaimAll } from '../mutations/use-claim-all'
import { gameKeys } from '../queries/game.keys'
import { useCatalogue, useFixtures, useGameConfig } from '../queries/use-game'
import { HubTiles } from './HubTiles'
import { MatchHero } from './MatchHero'
import { ReadyNow } from './ReadyNow'
import { StadiumCard } from './StadiumCard'
import { WelcomeBack } from './WelcomeBack'

const SEEN_KEY = 'pp-welcome-seen'

function newsOf(game: GameResponse) {
  return game.events.filter(event => event.type === 'matches' || (event.type === 'packs' && event.gained > 0))
}

/**
 * The home screen, in the order a returning player wants it: rewards to claim, what the stadium earned, the next match
 * (the biggest thing on screen), the other things to do, and the last result.
 */
export function ClubHub({ game }: { game: GameResponse }) {
  const client = useQueryClient()
  const config = useGameConfig()
  const fixtures = useFixtures(1)
  const last = fixtures.data?.[0]
  const unwatched = last ? !wasWatched(last) : false
  const { data: catalogue } = useCatalogue()
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
    <div className="flex flex-col gap-3">
      <ReadyNow game={game} claim={() => claim()} pending={pending} />
      <StadiumCard game={game} />
      <MatchHero game={game} onKickoff={sync} />
      <HubTiles game={game} />

      {last
        ? (
            <Link to={`/match/${last.no}`} className={`flex min-h-14 items-center gap-3 bg-base-100 px-3 py-2 ${unwatched ? 'shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'shadow-[inset_0_0_0_2px_var(--color-slate)]'}`}>
              <span className={`w-7 py-0.5 text-center font-bold ${last.result === 'win' ? 'bg-success text-success-content' : last.result === 'loss' ? 'bg-error text-error-content' : 'bg-warning text-warning-content'}`} aria-label={last.result}>
                {last.result[0].toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-sm ${unwatched ? 'text-primary' : 'text-muted'}`}>{unwatched ? 'New result · watch the match' : last.no === -1 ? 'First match' : last.no < 0 ? 'Last match: a friendly' : 'Last result · report'}</span>
                <span className="truncate">{`${last.goalsFor}–${last.goalsAgainst} v ${last.rival.name}`}</span>
              </span>
              <span className="text-muted" aria-hidden="true">›</span>
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

import type { GameResponse } from '@ld/pixel-pitch-core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { art } from '../lib/art'
import { kitOf, leagueName, nextRival, serverOffset } from '../lib/club'
import { gameKeys } from '../queries/game.keys'
import { useFixtures, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
import { Crest, Icon } from './sprites'
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
  const kit = kitOf(game)
  const rival = nextRival(game, config)
  // Captured when this answer arrived, so the countdown follows the server's clock.
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const last = fixtures.data?.[0]

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
      <section className="flex items-center gap-3">
        <Crest crest={game.club.crest} kit={kit} scale={3} label={`${game.club.name} crest`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-primary">{game.club.name}</h2>
          <span className="text-muted">{`${leagueName(state.league.tier)} · ${state.league.points}/${config.league.pointsToPromote} pts`}</span>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-lg" aria-label="Wallet">
        <span className="flex items-center gap-1 bg-base-100 px-2 py-1">
          <Icon path="icons/currency_coin.png" label="Coins" />
          <span className="tabular-nums">{state.coins.toLocaleString('en-GB')}</span>
        </span>
        <span className="flex items-center gap-1 bg-base-100 px-2 py-1">
          <Icon path="icons/currency_gem.png" label="Gems" />
          <span className="tabular-nums">{state.idle.gems}</span>
        </span>
        <span className="flex items-center gap-1 bg-base-100 px-2 py-1">
          <Icon path="icons/currency_pack.png" label="Packs" />
          <span className="tabular-nums">{state.idle.shelfPacks}</span>
        </span>
      </section>

      <section className="flex flex-col items-center gap-2 border-2 border-slate bg-base-100 p-4">
        <img src={art('club/stadium_lv1.png')} alt="" width={48 * 4} height={28 * 4} className="pixel" />
        <span className="text-muted">Next match</span>
        <span className="text-xl">{`v ${rival.name}`}</span>
        <span className="font-display text-sm text-primary">
          <Countdown to={state.league.nextKickoffAt} offset={offset} onDone={sync} />
        </span>
        <Link to="/squad" className="btn btn-primary min-h-11 w-full font-display text-xs">Set the lineup</Link>
      </section>

      {last
        ? (
            <Link to={`/match/${last.no}`} className="flex items-center justify-between border-2 border-slate bg-base-100 p-3">
              <span className="flex flex-col">
                <span className="text-muted">{last.no < 0 ? 'First match' : 'Last result'}</span>
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
              events={news}
              onClose={() => {
                sessionStorage.setItem(SEEN_KEY, String(game.now))
                setSeen(game.now)
              }}
            />
          )
        : null}
    </div>
  )
}

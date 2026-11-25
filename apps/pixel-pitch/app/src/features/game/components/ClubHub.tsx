import type { GameResponse } from '@ld/pixel-pitch-core'
import { albumSets, canBuy } from '@ld/pixel-pitch-core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { claimable } from '../lib/claimable'
import { kitOf, leagueName, nextRival, serverOffset } from '../lib/club'
import { claimCount, readyItems } from '../lib/ready-now'
import { useClaimAll } from '../mutations/use-claim-all'
import { gameKeys } from '../queries/game.keys'
import { useCatalogue, useFixtures, useGameConfig } from '../queries/use-game'
import { ConsentCard } from './ConsentCard'
import { Countdown } from './Countdown'
import { FirstSteps } from './FirstSteps'
import { ReadyNow } from './ReadyNow'
import { Crest, Icon } from './sprites'
import { StadiumCard } from './StadiumCard'
import { WarmupCard } from './WarmupCard'
import { WelcomeBack } from './WelcomeBack'

const SEEN_KEY = 'pp-welcome-seen'

function newsOf(game: GameResponse) {
  return game.events.filter(event => event.type === 'matches' || event.type === 'promotion' || event.type === 'season-end' || (event.type === 'packs' && event.gained > 0))
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
  const { data: catalogue } = useCatalogue()
  const waiting = claimable(game, config, albumSets(catalogue ?? [], config))
  const { claim, pending, pop } = useClaimAll()
  const claims = claimCount(readyItems(game, config, catalogue ?? []))
  const starter = config.shop.products.find(product => product.kind === 'starter')

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
        <Link to="/shop?from=wallet" className="flex items-center gap-1 bg-base-100 px-2 py-1" aria-label={`${state.idle.gems} gems. Open the shop`}>
          <Icon path="icons/currency_gem.png" label="Gems" />
          <span className="tabular-nums">{state.idle.gems}</span>
          <Icon path="icons/ui_plus.png" />
        </Link>
        <span className="flex items-center gap-1 bg-base-100 px-2 py-1">
          <Icon path="icons/currency_pack.png" label="Packs" />
          <span className="tabular-nums">{state.idle.shelfPacks}</span>
        </span>
      </section>

      {state.signings.pending > 0
        ? (
            <Link to="/signing" className="flex items-center justify-between border-2 border-accent bg-base-100 p-3">
              <span className="text-lg">{state.signings.pending === 1 ? 'A Star Signing is waiting: pick your player' : `${state.signings.pending} Star Signings are waiting`}</span>
              <span className="font-display text-xs text-accent">Choose ›</span>
            </Link>
          )
        : null}

      <FirstSteps game={game} />

      <ReadyNow game={game} claim={() => claim()} pending={pending} />

      {starter && state.league.fixtureNo > 0 && canBuy(state, starter, config, game.now)
        ? (
            <Link to="/shop?from=starter-banner" className="flex items-center justify-between border-2 border-warning bg-base-100 p-3">
              <span className="flex flex-col">
                <span className="text-lg text-warning">Starter offer</span>
                <span className="text-muted">A Star player of your choice, 300 gems and 5,000 coins. Once only.</span>
              </span>
              <span className="font-display text-xs">See offer ›</span>
            </Link>
          )
        : null}

      <ConsentCard />

      <section className="flex flex-col items-center gap-2 border-2 border-slate bg-base-100 p-4" aria-label="Next match">
        <span className="text-muted">Next match</span>
        <span className="text-xl">{`v ${rival.name}`}</span>
        <span className="font-display text-sm text-primary">
          <Countdown to={state.league.nextKickoffAt} offset={offset} onDone={sync} />
        </span>
        <Link to="/squad" className="btn btn-primary min-h-11 w-full font-display text-xs">Set the lineup</Link>
      </section>

      <WarmupCard game={game} />
      <StadiumCard game={game} />

      <nav className="grid grid-cols-2 gap-2" aria-label="More to do">
        {[
          { to: '/goals', label: 'Goals', note: 'Daily and calendar', icon: 'icons/ui_check.png', count: waiting.goals },
          { to: '/pass', label: 'League Pass', note: 'Season rewards', icon: 'icons/currency_trophy.png', count: waiting.pass },
          { to: '/album', label: 'Album', note: 'Collect sets', icon: 'icons/currency_star.png', count: waiting.album },
          { to: '/shop?from=hub', label: 'Shop', note: 'Pass, gems, kits', icon: 'icons/ui_shop.png', count: 0 },
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

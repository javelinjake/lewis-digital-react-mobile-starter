import type { GameResponse, PackSource, Position } from '@ld/pixel-pitch-core'
import { dayIndex, mergeable, oddsForTier, usedToday } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { telemetry } from '@/lib/telemetry/telemetry'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { art } from '../lib/art'
import { leagueName, serverOffset } from '../lib/club'
import { formatPercent, oddsRows, packArt } from '../lib/packs'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
import { PackReveal } from './PackReveal'
import { Icon } from './sprites'

const POSITIONS: Array<{ position: Position, label: string }> = [
  { position: 'GK', label: 'Keeper' },
  { position: 'DEF', label: 'Defender' },
  { position: 'MID', label: 'Midfielder' },
  { position: 'FWD', label: 'Forward' },
]

/** The pack shelf, the other ways to get packs, the odds, and the opening itself. */
export function PacksScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const [position, setPosition] = useState<Position>('FWD')
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])

  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const open = useGameAction((source: 'shelf' | 'star') => gameApi.openPack(source))
  const buy = useGameAction(() => gameApi.buyPack())
  const freePack = useGameAction(() => gameApi.claimFreePack())
  const arcade = useGameAction((chosen: Position) => gameApi.arcadePack(chosen))

  const capacity = state.idle.hasPass ? config.shelf.capacityWithPass : config.shelf.capacity
  const packs = state.idle.shelfPacks
  const nextPackAt = state.idle.shelfClockAt + config.shelf.intervalMinutes * 60_000
  const today = dayIndex(game.now, config)
  const boughtLeft = config.shelf.extraPacksPerDay - usedToday(state.extraPacks, today)
  const waiting = state.pendingPack !== null
  const busy = open.isPending || buy.isPending || arcade.isPending
  const toGo = config.packs.pityPlayers - state.pity
  const odds = oddsRows(state.league.tier, config)
  const groups = mergeable(game.cards, config)
  const hasOdds = oddsForTier(state.league.tier, config).length > 0
  // A pack already waiting opens at once when sent here to open one.
  const [revealing, setRevealing] = useState(() => waiting && new URLSearchParams(window.location.search).has('open'))
  // The pack the player has just asked for: the opening shows at once, with the pack shut until the server answers.
  const [opening, setOpening] = useState<PackSource | null>(null)
  // Open all: each pack shows its three players face up at once, and Done opens the next.
  const [all, setAll] = useState(false)
  const reveal = {
    onSuccess: (response: GameResponse) => {
      telemetry.track('pack_opened', { source: response.club.state.pendingPack?.source ?? 'unknown' })
      setRevealing(true)
    },
    onError: (error: unknown) => {
      setOpening(null)
      onError(error)
    },
  }
  /** Shows the opening straight away, then asks the server for the pack. */
  const start = (source: PackSource, ask: () => void) => {
    setOpening(source)
    ask()
  }

  // The pack pictures are fetched before they are needed, so the opening never waits on them.
  useEffect(() => {
    for (const from of ['shelf', 'star', 'arcade'] as const) {
      for (const half of ['_top.png', '_bottom.png'])
        new Image().src = art(packArt(state.league.tier, from).replace('.png', half))
    }
  }, [state.league.tier])

  // Sent here to open one (the daily free pack, Open packs after a claim): start the opening straight away.
  const [search, setSearch] = useSearchParams()
  const autoOpened = useRef(false)
  const { mutate: openPack } = open
  useEffect(() => {
    if (!search.get('open') || autoOpened.current)
      return
    autoOpened.current = true
    setSearch({}, { replace: true })
    if (!waiting && (state.starPacks > 0 || packs > 0))
      openPack(state.starPacks > 0 ? 'star' : 'shelf', { onSuccess: () => setRevealing(true), onError: error => toast.push(formatError(error), 'error') })
  }, [search, setSearch, waiting, state.starPacks, packs, openPack, toast])

  return (
    <div className="flex flex-col gap-3">
      {waiting
        ? (
            <section className="flex items-center gap-3 bg-raised p-3 shadow-[inset_0_0_0_3px_var(--color-primary)]">
              <span className="flex-1 text-lg font-bold text-primary">A pack is waiting for you</span>
              <button type="button" className="btn btn-primary min-h-12 px-5" onClick={() => setRevealing(true)}>Open it</button>
            </section>
          )
        : null}

      {!state.daily.freePackClaimed
        ? (
            <section className="flex items-center gap-3.5 bg-base-100 px-3.5 py-3 shadow-[inset_0_0_0_3px_var(--color-primary)]" aria-label="Daily free pack">
              <img src={art(packArt(state.league.tier))} alt="" width={40} height={52} className="pixel shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="pp-label">Daily free pack</div>
                <div className="text-xl font-bold text-primary">Ready to open</div>
                <div className="text-sm text-muted">{`${config.shelf.playersPerPack} players · a new one every day`}</div>
              </div>
              <button
                type="button"
                className="btn btn-primary h-13 w-21 shrink-0 text-lg"
                aria-label="Open your free pack"
                disabled={waiting || busy || freePack.isPending}
                onClick={() => start('shelf', () => freePack.mutate(undefined, { onSuccess: () => open.mutate('shelf', reveal), onError: reveal.onError }))}
              >
                Open
              </button>
            </section>
          )
        : null}

      <section className="flex flex-col gap-3 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Pack shelf">
        <div className="flex items-center gap-3.5">
          <img src={art(packArt(state.league.tier))} alt="" width={40 * 1.5} height={52 * 1.5} className="pixel shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="pp-label">Shelf</div>
            <div className="text-xl font-bold" aria-label={`${packs} of ${capacity} packs`}>{`${packs} of ${capacity} packs`}</div>
            <div className="text-sm text-muted">
              {packs >= capacity
                ? 'Full. Open one to start the clock again.'
                : (
                    <>
                      {'A new one in '}
                      <span className="text-primary"><Countdown to={nextPackAt} offset={offset} /></span>
                    </>
                  )}
            </div>
          </div>
        </div>
        <ul className="grid grid-cols-10 gap-1" aria-hidden="true">
          {Array.from({ length: capacity }, (_, slot) => (
            <li key={slot} className={`h-3 ${slot < packs ? 'bg-primary' : 'bg-base-200 shadow-[inset_0_0_0_1px_var(--color-slate)]'}`} />
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary h-13 text-lg"
          disabled={packs < 1 || waiting || busy}
          onClick={() => start('shelf', () => {
            setAll(false)
            open.mutate('shelf', reveal)
          })}
        >
          {packs < 1 ? 'No packs yet' : 'Open a pack'}
        </button>
        {packs + state.starPacks > 1
          ? (
              <button
                type="button"
                className="btn btn-outline min-h-12"
                disabled={waiting || busy}
                onClick={() => {
                  setAll(true)
                  const first = state.starPacks > 0 ? 'star' : 'shelf'
                  start(first, () => open.mutate(first, reveal))
                }}
              >
                {`Open all (${packs + state.starPacks})`}
              </button>
            )
          : null}
        {state.starPacks > 0
          ? (
              <button type="button" className="btn btn-accent h-13 text-lg" disabled={waiting || busy} onClick={() => start('star', () => open.mutate('star', reveal))}>
                {`Open a Star pack (${state.starPacks})`}
              </button>
            )
          : null}
      </section>

      <section className="grid grid-cols-2 gap-2.5" aria-label="Extra packs">
        <div className="flex flex-col items-center gap-1 bg-base-100 p-3 text-center shadow-[inset_0_0_0_2px_var(--color-slate)]">
          <img src={art(packArt(state.league.tier))} alt="" width={30} height={39} className="pixel" />
          <div className="text-lg font-bold">Buy a pack</div>
          <div className="text-sm text-muted">{boughtLeft > 0 ? `${config.shelf.playersPerPack} players · ${boughtLeft} left today` : 'None left today. Back tomorrow.'}</div>
          <button
            type="button"
            className="btn btn-accent mt-auto h-11 w-full gap-1.5"
            aria-label={`Buy a pack for ${config.shelf.extraPackCoins.toLocaleString('en-GB')} coins`}
            disabled={waiting || busy || boughtLeft < 1 || state.coins < config.shelf.extraPackCoins}
            onClick={() => start('buy', () => buy.mutate(undefined, reveal))}
          >
            <Icon path="icons/currency_coin.png" />
            {config.shelf.extraPackCoins.toLocaleString('en-GB')}
          </button>
        </div>
        <div className="flex flex-col items-center gap-1 bg-base-100 p-3 text-center shadow-[inset_0_0_0_2px_var(--color-slate)]">
          <img src={art(packArt(state.league.tier, 'arcade'))} alt="" width={30} height={39} className="pixel" />
          <div className="text-lg font-bold">Arcade pack</div>
          <label className="flex w-full items-center gap-1 text-sm text-muted">
            <span>More</span>
            <select className="select select-xs min-h-9 flex-1 bg-base-200" value={position} onChange={event => setPosition(event.target.value as Position)} aria-label="Arcade pack position">
              {POSITIONS.map(entry => <option key={entry.position} value={entry.position}>{`${entry.label.toLowerCase()}s`}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-accent mt-auto h-11 w-full gap-1.5"
            aria-label={`Arcade pack: more ${POSITIONS.find(entry => entry.position === position)?.label.toLowerCase()}s for ${config.cabinets.arcadePackTokens} tokens`}
            disabled={waiting || busy || state.tokens < config.cabinets.arcadePackTokens}
            onClick={() => start('arcade', () => arcade.mutate(position, reveal))}
          >
            <Icon path="icons/currency_token.png" />
            {config.cabinets.arcadePackTokens}
          </button>
        </div>
      </section>
      <span className="-mt-1 text-center text-sm text-muted">{`You have ${state.tokens} tokens. Win more in the arcade.`}</span>

      {groups.length > 0
        ? (
            <Link to="/squad?view=merge" className="flex items-center gap-3 bg-base-100 px-3 py-2.5 shadow-[inset_0_0_0_2px_var(--color-accent)]">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{`${groups.length} ${groups.length === 1 ? 'player' : 'players'} ready to merge`}</span>
                <span className="block text-sm text-muted">{`${config.cards.mergeCopies} copies make one card a star higher`}</span>
              </span>
              <span className="btn btn-outline btn-sm min-h-11 px-4">Review</span>
            </Link>
          )
        : null}

      <section className="flex flex-col gap-1.5 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Pack odds">
        <div className="pp-label">{`Odds in ${leagueName(state.league.tier)}`}</div>
        {hasOdds
          ? (
              <ul className="grid grid-cols-3 gap-1 text-center">
                {odds.map(row => (
                  <li key={row.rarity} className="flex flex-col bg-base-200 py-1">
                    <span className="text-xs text-muted">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums">{formatPercent(row.percent)}</span>
                  </li>
                ))}
              </ul>
            )
          : null}
        <span className="text-sm text-muted">{`A Star or better is guaranteed within ${config.packs.pityPlayers} players. ${toGo} to go.`}</span>
      </section>

      {(revealing && waiting) || opening
        ? (
            <PackReveal
              // A new pack is a fresh opening; the same pack keeps its place.
              key={state.packsOpened}
              game={game}
              source={opening ?? undefined}
              quick={all}
              onClose={() => {
                setRevealing(false)
                setOpening(null)
              }}
              // Straight on to the next one: a Star pack first if there is one, then the shelf.
              onNext={() => {
                const next = state.starPacks > 0 ? 'star' : 'shelf'
                start(next, () => open.mutate(next, reveal))
              }}
            />
          )
        : null}
    </div>
  )
}

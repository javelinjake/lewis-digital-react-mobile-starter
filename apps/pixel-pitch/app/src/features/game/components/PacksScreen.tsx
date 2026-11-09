import type { GameResponse, Position } from '@ld/pixel-pitch-core'
import { dayIndex, oddsForTier, usedToday } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useMemo, useState } from 'react'
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
  const [revealing, setRevealing] = useState(false)
  const [position, setPosition] = useState<Position>('FWD')
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])

  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const open = useGameAction((source: 'shelf' | 'star') => gameApi.openPack(source))
  const buy = useGameAction(() => gameApi.buyPack())
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
  const hasOdds = oddsForTier(state.league.tier, config).length > 0
  const reveal = { onSuccess: () => setRevealing(true), onError }

  return (
    <div className="flex flex-col gap-4">
      {waiting
        ? (
            <section className="flex flex-col items-center gap-2 border-2 border-primary bg-base-100 p-3">
              <span className="text-lg">A pack is waiting for you</span>
              <button type="button" className="btn btn-primary min-h-11 w-full font-display text-xs" onClick={() => setRevealing(true)}>Open it</button>
            </section>
          )
        : null}

      <section className="flex flex-col gap-3 border-2 border-slate bg-base-100 p-3" aria-label="Pack shelf">
        <div className="flex items-baseline justify-between">
          <h2>Shelf</h2>
          <span className="tabular-nums" aria-label={`${packs} of ${capacity} packs`}>{`${packs}/${capacity}`}</span>
        </div>
        <ul className="grid grid-cols-8 gap-1" aria-hidden="true">
          {Array.from({ length: capacity }, (_, slot) => (
            <li key={slot} className="flex justify-center">
              <img src={art(slot < packs ? 'ui/shelf_slot_full.png' : 'ui/shelf_slot_empty.png')} alt="" width={8 * 3} height={10 * 3} className="pixel" />
            </li>
          ))}
        </ul>
        <span className="text-muted">
          {packs >= capacity
            ? 'The shelf is full. Open a pack to start the clock again.'
            : (
                <>
                  {'Next pack in '}
                  <span className="text-primary"><Countdown to={nextPackAt} offset={offset} /></span>
                </>
              )}
        </span>
        <div className="flex items-center gap-3">
          <img src={art(packArt(state.league.tier))} alt="" width={40 * 2} height={52 * 2} className="pixel" />
          <button type="button" className="btn btn-primary min-h-12 flex-1 font-display text-xs" disabled={packs < 1 || waiting || busy} onClick={() => open.mutate('shelf', reveal)}>
            {packs < 1 ? 'No packs yet' : 'Open a pack'}
          </button>
        </div>
        {state.starPacks > 0
          ? (
              <div className="flex items-center gap-3">
                <img src={art('packs/pack_holo.png')} alt="" width={40 * 2} height={52 * 2} className="pixel" />
                <button type="button" className="btn btn-accent min-h-12 flex-1 font-display text-xs" disabled={waiting || busy} onClick={() => open.mutate('star', reveal)}>
                  {`Open a Star pack (${state.starPacks})`}
                </button>
              </div>
            )
          : null}
      </section>

      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Extra packs">
        <h2>More packs</h2>
        <button type="button" className="btn btn-outline min-h-11 justify-between" disabled={waiting || busy || boughtLeft < 1 || state.coins < config.shelf.extraPackCoins} onClick={() => buy.mutate(undefined, reveal)}>
          <span>Buy a pack</span>
          <span>
            <Icon path="icons/currency_coin.png" />
            {` ${config.shelf.extraPackCoins.toLocaleString('en-GB')}`}
          </span>
        </button>
        <span className="text-muted">{boughtLeft > 0 ? `${boughtLeft} left today` : 'None left today. Back tomorrow.'}</span>

        <div role="radiogroup" aria-label="Arcade pack position" className="mt-2 grid grid-cols-4 gap-1">
          {POSITIONS.map(entry => (
            <button key={entry.position} type="button" role="radio" aria-checked={position === entry.position} className={`min-h-11 border-2 text-sm ${position === entry.position ? 'border-primary bg-base-300' : 'border-base-300'}`} onClick={() => setPosition(entry.position)}>
              {entry.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline min-h-11 justify-between" disabled={waiting || busy || state.tokens < config.cabinets.arcadePackTokens} onClick={() => arcade.mutate(position, reveal)}>
          <span>{`Arcade pack: more ${POSITIONS.find(entry => entry.position === position)?.label.toLowerCase()}s`}</span>
          <span>
            <Icon path="icons/currency_token.png" />
            {` ${config.cabinets.arcadePackTokens}`}
          </span>
        </button>
        <span className="text-muted">{`You have ${state.tokens} tokens. Play the arcade to earn more.`}</span>
      </section>

      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Pack odds">
        <h2>{`Odds in ${leagueName(state.league.tier)}`}</h2>
        {hasOdds
          ? (
              <ul className="flex flex-col gap-1">
                {odds.map(row => (
                  <li key={row.rarity} className="flex justify-between text-lg">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{formatPercent(row.percent)}</span>
                  </li>
                ))}
              </ul>
            )
          : null}
        <span className="text-muted">{`A Star or better is guaranteed within ${config.packs.pityPlayers} players. ${toGo} to go.`}</span>
      </section>

      {revealing && waiting ? <PackReveal game={game} onClose={() => setRevealing(false)} /> : null}
    </div>
  )
}

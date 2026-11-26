import type { GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { albumSets, challengeCabinet, challengePlayed, dayIndex, energyAt, maxXp, nextEnergyAt, tierReached } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { claimable } from '../lib/claimable'
import { serverOffset } from '../lib/club'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'

const DAY = 24 * 60 * 60 * 1000

const tileClass = 'relative flex min-h-24 flex-col gap-1 bg-base-100 p-3 text-left shadow-[inset_0_0_0_2px_var(--color-slate)]'

function Corner({ children, label }: { children: ReactNode, label: string }) {
  return <span className="absolute -top-2 -right-1.5 bg-error px-1.5 text-xs font-bold text-error-content" aria-label={label}>{children}</span>
}

function Bar({ value, colour }: { value: number, colour: string }) {
  return (
    <span className="block h-1.5 bg-base-200" aria-hidden="true">
      <span className="block h-1.5" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: colour }} />
    </span>
  )
}

/**
 * Four tiles under the match card, each with its state at a glance and a count when something is waiting: packs (the
 * daily free one first), goals, the arcade and the League Pass. Then the album, in a slim row.
 */
export function HubTiles({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: catalogue } = useCatalogue()
  const now = useServerNow(game)
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const freePack = useGameAction(() => gameApi.claimFreePack())
  const { state } = game.club
  const waiting = claimable(game, config, albumSets(catalogue ?? [], config))

  const packs = state.idle.shelfPacks + state.starPacks + (state.pendingPack ? 1 : 0)
  const nextPackAt = state.idle.shelfClockAt + config.shelf.intervalMinutes * 60_000
  const goalsDone = state.daily.goals.filter(goal => goal.progress >= goal.target).length
  const goalsTotal = state.daily.goals.length
  const resetsAt = (dayIndex(now, config) + 1) * DAY + config.daily.dayStartOffsetMinutes * 60_000
  const energy = energyAt(state, config, now)
  const nextPlayAt = nextEnergyAt(state, config, now)
  const reached = tierReached(state, config)
  const atTop = state.pass.xp >= maxXp(config)
  const tierXp = state.pass.xp - reached * config.pass.xpPerTier

  return (
    <nav className="flex flex-col gap-2.5" aria-label="More to do">
      <div className="grid grid-cols-2 gap-2.5">
        {state.daily.freePackClaimed
          ? (
              <Link to="/packs" className={tileClass}>
                <span className="text-lg font-bold text-primary">Packs</span>
                <span className="text-sm text-muted">
                  {packs > 0
                    ? `${packs} to open`
                    : (
                        <>
                          {'Next in '}
                          <Countdown to={nextPackAt} offset={offset} />
                        </>
                      )}
                </span>
                {packs > 0 ? <Corner label={`${packs} to open`}>{packs}</Corner> : null}
              </Link>
            )
          : (
              <button
                type="button"
                className={tileClass}
                disabled={freePack.isPending}
                onClick={() => freePack.mutate(undefined, { onSuccess: () => navigate('/packs?open=1'), onError: error => toast.push(formatError(error), 'error') })}
              >
                <span className="text-lg font-bold text-primary">Daily pack</span>
                <span className="text-sm text-muted">{packs > 0 ? `Free one ready · ${packs} to open` : 'Ready to open'}</span>
                <Corner label="Free">FREE</Corner>
              </button>
            )}

        <Link to="/goals" className={tileClass}>
          <span className="text-lg font-bold text-primary">Goals</span>
          <Bar value={goalsTotal ? goalsDone / goalsTotal : 0} colour="var(--color-success)" />
          <span className="text-sm text-muted">
            {`${goalsDone} of ${goalsTotal} · resets in `}
            <Countdown to={resetsAt} offset={offset} />
          </span>
          {waiting.goals > 0 ? <Corner label={`${waiting.goals} to claim`}>{waiting.goals}</Corner> : null}
        </Link>

        <Link to="/arcade" className={tileClass}>
          <span className="text-lg font-bold text-primary">Arcade</span>
          <span className="text-sm text-muted">
            {energy > 0
              ? `${energy} ${energy === 1 ? 'play' : 'plays'} ready`
              : nextPlayAt === null
                ? 'Out of energy'
                : (
                    <>
                      {'Next play in '}
                      <Countdown to={nextPlayAt} offset={offset} />
                    </>
                  )}
          </span>
        </Link>

        <Link to="/pass" className={tileClass}>
          <span className="text-lg font-bold text-primary">League Pass</span>
          <Bar value={atTop ? 1 : tierXp / config.pass.xpPerTier} colour="var(--color-accent)" />
          <span className="text-sm text-muted">{atTop ? 'Every tier reached' : `Tier ${reached} · ${tierXp} of ${config.pass.xpPerTier} XP`}</span>
          {waiting.pass > 0 ? <Corner label={`${waiting.pass} to claim`}>{waiting.pass}</Corner> : null}
        </Link>
      </div>

      <Link to="/challenge" className="relative flex min-h-11 items-center justify-between bg-base-100 px-3 shadow-[inset_0_0_0_2px_var(--color-warning)]">
        <span>
          <span className="font-bold text-warning">Daily challenge</span>
          <span className="text-sm text-muted">
            {challengePlayed(state, now, config)
              ? ` · played: ${state.challenge.score}`
              : ` · ${CABINETS.find(entry => entry.cabinet === challengeCabinet(now, config))!.name}, ready`}
          </span>
        </span>
        <span className="text-muted" aria-hidden="true">›</span>
        {challengePlayed(state, now, config) ? null : <Corner label="Ready to play">1</Corner>}
      </Link>

      {state.chances.length > 0
        ? (
            <Link to="/chances" className="relative flex min-h-11 items-center justify-between bg-base-100 px-3 shadow-[inset_0_0_0_2px_var(--color-accent)]">
              <span>
                <span className="font-bold text-accent">Big Chances</span>
                <span className="text-sm text-muted">{` · ${state.chances.length} to play`}</span>
              </span>
              <span className="text-muted" aria-hidden="true">›</span>
              <Corner label={`${state.chances.length} to play`}>{state.chances.length}</Corner>
            </Link>
          )
        : null}

      <Link to="/shop" className="relative flex min-h-11 items-center justify-between bg-base-100 px-3 shadow-[inset_0_0_0_2px_var(--color-slate)]">
        <span>
          <span className="font-bold text-primary">Shop</span>
          <span className="text-sm text-muted"> · kits for gems</span>
        </span>
        <span className="text-muted" aria-hidden="true">›</span>
      </Link>

      <Link to="/album" className="relative flex min-h-11 items-center justify-between bg-base-100 px-3 shadow-[inset_0_0_0_2px_var(--color-slate)]">
        <span>
          <span className="font-bold text-primary">Album</span>
          <span className="text-sm text-muted">{` · ${state.album.collected.length} players collected`}</span>
        </span>
        <span className="text-muted" aria-hidden="true">›</span>
        {waiting.album > 0 ? <Corner label={`${waiting.album} to claim`}>{waiting.album}</Corner> : null}
      </Link>
    </nav>
  )
}

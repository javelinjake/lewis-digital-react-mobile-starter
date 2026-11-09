import type { GameResponse, WarmupZone } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useGameAction } from '../mutations/use-game-action'
import { WarmupGame } from './WarmupGame'

const ZONE_TEXT: Record<WarmupZone, string> = { gold: 'Perfect', green: 'Good', miss: 'A miss' }

/** One try at the warm-up kick before each match: up to +10% attack for it. */
export function WarmupCard({ game }: { game: GameResponse }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<{ zone: WarmupZone, bonus: number } | null>(null)
  const start = useGameAction(() => gameApi.startWarmup())
  const finish = useGameAction((tapMs: number) => gameApi.finishWarmup(tapMs))
  const { state } = game.club
  const tried = state.warmupTriedFor === state.league.fixtureNo
  const ticket = state.ticket?.kind === 'warmup' ? state.ticket : null
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  return (
    <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Warm-up kick">
      <h2>Warm-up kick</h2>
      {open && ticket
        ? (
            <WarmupGame
              key={ticket.id}
              seed={ticket.seed}
              onFinish={tapMs => finish.mutate(tapMs, {
                onSuccess: (response) => {
                  setLast({ zone: response.zone, bonus: response.bonus })
                  setOpen(false)
                },
                onError: (error) => {
                  onError(error)
                  setOpen(false)
                },
              })}
            />
          )
        : tried
          ? (
              <span className="text-lg">
                {state.league.warmupBonus > 0
                  ? `${last ? `${ZONE_TEXT[last.zone]}. ` : ''}+${Math.round(state.league.warmupBonus * 100)}% attack in your next match.`
                  : 'You have warmed up for this match.'}
              </span>
            )
          : (
              <>
                <span className="text-muted">Stop the marker in the zone for up to +10% attack in your next match. One try.</span>
                <button type="button" className="btn btn-accent min-h-11 font-display text-xs" disabled={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: () => setOpen(true), onError })}>
                  Warm up
                </button>
              </>
            )}
    </section>
  )
}

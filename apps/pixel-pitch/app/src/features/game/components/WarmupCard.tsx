import type { GameResponse, WarmupZone } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { WarmupGame } from './WarmupGame'

const ZONE_TEXT: Record<WarmupZone, string> = { gold: 'Perfect', green: 'Good', miss: 'A miss' }

/**
 * The warm-up kick, in the sheet the match card opens: what it is worth, one try at the timing bar, and what it gave.
 * Up to +10% attack in the next league match.
 */
export function WarmupPanel({ game, onDone }: { game: GameResponse, onDone: () => void }) {
  const toast = useToast()
  const { match } = useGameConfig()
  const pct = (value: number) => `+${Math.round(value * 100)}%`
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<WarmupZone | null>(null)
  const start = useGameAction(() => gameApi.startWarmup())
  const finish = useGameAction((tapMs: number) => gameApi.finishWarmup(tapMs))
  const { state } = game.club
  const tried = state.warmupTriedFor === state.league.fixtureNo
  const bonus = state.league.warmupBonus
  const ticket = state.ticket?.kind === 'warmup' ? state.ticket : null
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  if (open && ticket) {
    return (
      <WarmupGame
        key={ticket.id}
        seed={ticket.seed}
        onFinish={tapMs => finish.mutate(tapMs, {
          onSuccess: (response) => {
            setLast(response.zone)
            setOpen(false)
          },
          onError: (error) => {
            onError(error)
            setOpen(false)
          },
        })}
      />
    )
  }

  if (tried) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-lg">
          {bonus > 0
            ? `${last ? `${ZONE_TEXT[last]}. ` : ''}${pct(bonus)} attack in your next league match only.`
            : 'You have warmed up for this match.'}
        </span>
        <button type="button" className="btn btn-primary min-h-12" onClick={onDone}>Done</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <span>{`One try before each league match. Stop the marker in the gold zone for ${pct(match.warmupGold)} attack, the green for ${pct(match.warmupGreen)}, anywhere else ${pct(match.warmupMiss)}.`}</span>
      <span className="text-sm text-muted">It counts for the next match only, and shows in your win chance.</span>
      <button type="button" className="btn btn-accent min-h-12" disabled={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: () => setOpen(true), onError })}>
        Take the kick
      </button>
    </div>
  )
}

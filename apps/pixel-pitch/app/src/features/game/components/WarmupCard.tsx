import type { AnyTaps, GameResponse, WarmupResult, WarmupZone } from '@ld/pixel-pitch-core'
import { isCabinet, warmupCabinet } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { kitOf } from '../lib/club'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { cabinetGame } from './cabinet-games'
import { CabinetArt } from './CabinetArt'
import { PlayTuning } from './PlayTuning'

const ZONE_TEXT: Record<WarmupZone, string> = { gold: 'Gold!', green: 'Good warm-up', miss: 'Not your best' }

const pct = (value: number) => `${Math.round(value * 100)}%`

/**
 * The warm-up, in the sheet the match card opens: a free play of one arcade game (a different one each match), what
 * it is worth, the game itself, and what it gave. Up to +10% attack in the next league match. It pays no tokens.
 */
export function WarmupPanel({ game, onDone }: { game: GameResponse, onDone: () => void }) {
  const toast = useToast()
  const config = useGameConfig()
  const { match, minigames } = config
  const [playing, setPlaying] = useState(false)
  const [result, setResult] = useState<WarmupResult | null>(null)
  const start = useGameAction(() => gameApi.startWarmup())
  const finish = useGameAction((taps: AnyTaps) => gameApi.finishWarmup(taps))
  const retry = useGameAction(() => gameApi.retryWarmup())
  const { state } = game.club
  const tried = state.warmupTriedFor === state.league.fixtureNo
  const bonus = state.league.warmupBonus
  const ticket = state.ticket?.kind === 'warmup' && isCabinet(state.ticket.cabinet) ? state.ticket : null
  // The game is the ticket's once it is started; before that, the same pick the server will make.
  const cabinet = ticket?.cabinet ?? warmupCabinet(game.club.id, state.league.fixtureNo)
  const info = CABINETS.find(entry => entry.cabinet === cabinet)!
  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const pays = `Score ${pct(minigames.warmup.gold)}+ for +${pct(match.warmupGold)} attack, ${pct(minigames.warmup.green)}+ for +${pct(match.warmupGreen)}, anything else +${pct(match.warmupMiss)}.`

  if (playing && ticket) {
    const Game = cabinetGame(cabinet)
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-primary">{info.name}</h3>
        {finish.isPending ? <span className="text-muted">Checking your warm-up…</span> : null}
        <PlayTuning ticket={ticket}>
          <Game
            key={ticket.id}
            seed={ticket.seed}
            onFinish={taps => finish.mutate(taps, {
              onSuccess: (response) => {
                setResult({ cabinet: response.cabinet, score: response.score, max: response.max, zone: response.zone, bonus: response.bonus })
                setPlaying(false)
              },
              onError: (error) => {
                onError(error)
                setPlaying(false)
              },
            })}
          />
        </PlayTuning>
      </div>
    )
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" aria-label="Warm-up result">
        <div className="pp-grass flex h-24 w-full items-end justify-center border-2 border-slate" aria-hidden="true">
          <CabinetArt cabinet={result.cabinet} kit={kitOf(game)} scale={4} />
        </div>
        <span className="font-display text-sm text-primary tabular-nums">{`${CABINETS.find(entry => entry.cabinet === result.cabinet)!.name}: ${result.score} of ${result.max} (${pct(result.max > 0 ? result.score / result.max : 0)})`}</span>
        <span className={`text-xl ${result.zone === 'gold' ? 'text-warning' : result.zone === 'green' ? 'text-success' : 'text-muted'}`} role="status">{ZONE_TEXT[result.zone]}</span>
        <span className="text-lg">{`+${pct(result.bonus)} attack in your next league match only.`}</span>
        <button type="button" className="btn btn-primary min-h-12 w-full" onClick={onDone}>Done</button>
      </div>
    )
  }

  if (tried && !ticket) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-lg">
          {bonus > 0 ? `You have warmed up: +${pct(bonus)} attack in your next league match only.` : 'You have warmed up for this match.'}
        </span>
        {bonus < match.warmupGold
          ? (
              <button type="button" className="btn btn-ghost min-h-11" disabled={retry.isPending || state.idle.gems < config.shop.gems.warmupRetry} onClick={() => retry.mutate(undefined, { onSuccess: () => setPlaying(true), onError })}>
                {`Another try · ${config.shop.gems.warmupRetry} gems`}
              </button>
            )
          : null}
        <button type="button" className="btn btn-primary min-h-12" onClick={onDone}>Done</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="pp-grass flex h-24 items-end justify-center border-2 border-slate" aria-hidden="true">
        <CabinetArt cabinet={cabinet} kit={kitOf(game)} scale={4} />
      </div>
      <h3 className="text-primary">{`Today's warm-up: ${info.name}`}</h3>
      <span className="text-lg">{pays}</span>
      <span>{info.how}</span>
      <span className="text-sm text-muted">One try before each league match, and it is free: no energy, and no tokens. It counts for the next match only, and shows in your win chance.</span>
      {ticket
        ? <button type="button" className="btn btn-accent min-h-12" onClick={() => setPlaying(true)}>{`Play ${info.name}`}</button>
        : (
            <button type="button" className="btn btn-accent min-h-12" disabled={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: () => setPlaying(true), onError })}>
              {`Warm up: play ${info.name}`}
            </button>
          )}
    </div>
  )
}

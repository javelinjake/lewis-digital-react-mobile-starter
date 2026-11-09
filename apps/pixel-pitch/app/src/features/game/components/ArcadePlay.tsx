import type { Cabinet, GameResponse, PlayResult } from '@ld/pixel-pitch-core'
import { freePlaysLeft } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { KeepyGame } from './KeepyGame'
import { KickTimerGame } from './KickTimerGame'
import { Icon } from './sprites'

type Phase = 'intro' | 'playing' | 'result'

/** One play of a cabinet: start (the server issues the ticket), play, send the taps, see what it paid. */
export function ArcadePlay({ game, cabinet }: { game: GameResponse, cabinet: Cabinet }) {
  const config = useGameConfig()
  const toast = useToast()
  const [search] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('intro')
  const [result, setResult] = useState<(GameResponse & PlayResult) | null>(null)
  const start = useGameAction((paid: boolean) => gameApi.startPlay(cabinet, paid))
  const finish = useGameAction((taps: number[]) => gameApi.finishPlay(cabinet, taps))
  const info = CABINETS.find(entry => entry.cabinet === cabinet)!
  const { state } = game.club
  const left = freePlaysLeft(state, cabinet, config, game.now)
  const paid = left < 1
  const ticket = state.ticket?.kind === cabinet ? state.ticket : null

  const begin = () => start.mutate(paid, {
    onSuccess: () => setPhase('playing'),
    onError: error => toast.push(formatError(error), 'error'),
  })
  const submit = (taps: number[]) => finish.mutate(taps, {
    onSuccess: (response) => {
      setResult(response)
      setPhase('result')
    },
    onError: (error) => {
      toast.push(formatError(error), 'error')
      setPhase('intro')
    },
  })

  if (phase === 'playing' && ticket) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-primary">{info.name}</h2>
        {finish.isPending ? <span className="text-muted">Checking your play…</span> : null}
        {cabinet === 'kick' ? <KickTimerGame key={ticket.id} seed={ticket.seed} onFinish={submit} /> : <KeepyGame key={ticket.id} seed={ticket.seed} onFinish={submit} />}
      </div>
    )
  }

  if (phase === 'result' && result) {
    const nextLeft = freePlaysLeft(result.club.state, cabinet, config, result.now)
    return (
      <div className="flex flex-col items-center gap-3 border-2 border-primary bg-base-100 p-4" aria-label="Result">
        <h2 className="text-primary">{info.name}</h2>
        <span className="font-display text-lg tabular-nums">{`${result.score} / ${result.max}`}</span>
        {result.tokens > 0
          ? (
              <span className="text-xl">
                <Icon path="icons/currency_token.png" />
                {` +${result.tokens} tokens`}
              </span>
            )
          : null}
        {result.coins > 0
          ? (
              <span className="text-xl">
                <Icon path="icons/currency_coin.png" />
                {` +${result.coins} coins`}
              </span>
            )
          : null}
        {result.tokens === 0 && result.coins === 0 ? <span className="text-muted">Nothing this time. Try again.</span> : null}
        <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={() => setPhase('intro')}>
          {nextLeft > 0 ? `Play again · ${nextLeft} free left` : 'Done'}
        </button>
        <Link to="/arcade" className="btn btn-ghost min-h-11 w-full">Back to the arcade</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-primary">{info.name}</h2>
      <span className="text-lg">{info.blurb}</span>
      {paid
        ? <span className="text-muted">{`No free plays left today. An extra play costs ${config.cabinets.gemPlayCost} gems and pays coins and Pass XP, not tokens.`}</span>
        : <span className="text-muted">{`${left} free ${left === 1 ? 'play' : 'plays'} left today.`}</span>}
      {search.get('paid') && !paid ? <span className="text-muted">You still have free plays, so this one is free.</span> : null}
      <button type="button" className="btn btn-primary min-h-12 font-display text-xs" disabled={start.isPending} onClick={begin}>
        {paid ? `Start · ${config.cabinets.gemPlayCost} gems` : 'Start'}
      </button>
      <Link to="/arcade" className="btn btn-ghost min-h-11">Back</Link>
    </div>
  )
}

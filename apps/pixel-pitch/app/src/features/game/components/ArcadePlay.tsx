import type { AnyTaps, Cabinet, GameResponse, PlayResult } from '@ld/pixel-pitch-core'
import { energyAt, hotCabinet } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS, topScore } from '../lib/cabinets'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { cabinetGame } from './cabinet-games'
import { EnergyBar } from './EnergyBar'
import { NextSteps } from './NextSteps'
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
  const finish = useGameAction((taps: AnyTaps) => gameApi.finishPlay(cabinet, taps))
  const info = CABINETS.find(entry => entry.cabinet === cabinet)!
  const { state } = game.club
  const energy = energyAt(state, config, game.now)
  const paid = energy < 1
  const hot = hotCabinet(game.now, config) === cabinet
  const best = state.arcade.best[cabinet]
  const ticket = state.ticket?.kind === cabinet ? state.ticket : null
  const bonus = Math.round(config.cabinets.hotBonus * 100)
  /** Whether the play being finished (or just finished) was bought with gems: it pays coins, not tokens. */
  const [ticketPaid, setTicketPaid] = useState(false)

  const begin = () => start.mutate(paid, {
    onSuccess: () => {
      setTicketPaid(paid)
      setPhase('playing')
    },
    onError: error => toast.push(formatError(error), 'error'),
  })
  const submit = (taps: AnyTaps) => finish.mutate(taps, {
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
    const Game = cabinetGame(cabinet)
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-primary">{info.name}</h2>
        {finish.isPending ? <span className="text-muted">Checking your play…</span> : null}
        <Game key={ticket.id} seed={ticket.seed} onFinish={submit} />
      </div>
    )
  }

  if (phase === 'result' && result) {
    const energyLeft = energyAt(result.club.state, config, result.now)
    const top = result.max
    const verdict = result.newBest
      ? (result.previousBest > 0 ? 'New best!' : 'First score on the board!')
      : result.score === 0 && result.previousBest === 0
        ? 'Nothing on the board yet. Have another go.'
        : result.score === result.previousBest
          ? 'Level with your best.'
          : `${result.previousBest - result.score} off your best of ${result.previousBest}.`
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-3 border-2 border-primary bg-base-100 p-4" aria-label="Result">
          <h2 className="text-primary">{info.name}</h2>
          {ticketPaid
            ? (
                <span className="flex items-center gap-2 text-center font-display text-sm tabular-nums">
                  <Icon path="icons/currency_coin.png" />
                  {`Score ${result.score} of ${top} → ${result.coins} coins`}
                </span>
              )
            : (
                <span className="flex items-center gap-2 text-center font-display text-sm tabular-nums">
                  <Icon path="icons/currency_token.png" />
                  {`Score ${result.score} of ${top} → ${result.tokens} tokens`}
                </span>
              )}
          {result.hot && !ticketPaid ? <span className="text-warning">{`Includes +${bonus}% for today's game.`}</span> : null}
          <span className={result.newBest ? 'text-xl text-success' : 'text-lg text-muted'} role="status">{verdict}</span>
          {result.tokens === 0 && result.coins === 0 ? <span className="text-muted">Nothing this time. Try again.</span> : null}
        </div>
        {energyLeft > 0
          ? <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={() => setPhase('intro')}>{`Play again · ${energyLeft} energy left`}</button>
          : (
              <>
                <EnergyBar game={result} />
                <Link to={`/arcade/${cabinet}?paid=1`} className="btn btn-outline min-h-12" onClick={() => setPhase('intro')}>{`Extra play · ${config.cabinets.gemPlayCost} gems`}</Link>
              </>
            )}
        <NextSteps skip={['arcade']} />
        <Link to="/arcade" className="btn btn-ghost min-h-11 w-full">Back to the arcade</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-primary">{info.name}</h2>
      <span className="text-lg">{info.how}</span>
      <span className="text-lg tabular-nums">{best > 0 ? `Your best: ${best} / ${topScore(cabinet, config)}` : 'Not played yet'}</span>
      <span className="text-muted">{`Up to ${config.cabinets.playMaxTokens} tokens a play, in proportion to your score; +${bonus}% on today's game.`}</span>
      {hot ? <span className="text-warning">{`This is today's game: +${bonus}% tokens.`}</span> : null}
      <EnergyBar game={game} />
      {paid
        ? <span className="text-muted">{`Out of energy. An extra play costs ${config.cabinets.gemPlayCost} gems and pays coins and Pass XP, not tokens.`}</span>
        : <span className="text-muted">This play costs 1 energy.</span>}
      {search.get('paid') && !paid ? <span className="text-muted">You still have energy, so this one uses that instead of gems.</span> : null}
      <button type="button" className="btn btn-primary min-h-12 font-display text-xs" disabled={start.isPending} onClick={begin}>
        {paid ? `Start · ${config.cabinets.gemPlayCost} gems` : 'Start · 1 energy'}
      </button>
      <Link to="/arcade" className="btn btn-ghost min-h-11">Back</Link>
    </div>
  )
}

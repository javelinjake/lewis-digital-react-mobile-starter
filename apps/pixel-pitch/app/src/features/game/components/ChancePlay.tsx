import type { AnyTaps, Chance, ChanceResult, GameResponse } from '@ld/pixel-pitch-core'
import { CHANCE_CABINET } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useEffect, useRef, useState } from 'react'
import { play } from '@/lib/sound/sound'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CHANCE_NAME, chanceHow, chanceStakes } from '../lib/chances'
import { leagueName } from '../lib/club'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { cabinetGame } from './cabinet-games'
import { PlayTuning } from './PlayTuning'

/**
 * One match moment: start it (the server issues one round of the arcade game, at the club's league), play it, and
 * show what came of it. `started` skips the button for a live moment the player has already chosen to take.
 */
export function ChancePlay({ game, chance, started = false, onStart, onDone }: { game: GameResponse, chance: Chance, started?: boolean, onStart?: () => void, onDone: (result: GameResponse & ChanceResult | null) => void }) {
  const toast = useToast()
  const config = useGameConfig()
  const startedTicket = game.club.state.ticket?.kind === 'chance' && game.club.state.ticket.chance?.fixtureNo === chance.fixtureNo
  const [playing, setPlaying] = useState(started && startedTicket)
  const [result, setResult] = useState<(GameResponse & ChanceResult) | null>(null)
  const start = useGameAction(() => gameApi.startChance(chance.fixtureNo))
  const finish = useGameAction((taps: AnyTaps) => gameApi.finishChance(taps))
  const { state } = game.club
  const ticket = state.ticket?.kind === 'chance' && state.ticket.chance?.fixtureNo === chance.fixtureNo ? state.ticket : null
  const asked = useRef(false)

  const begin = () => {
    onStart?.()
    if (ticket) {
      setPlaying(true)
      return
    }
    start.mutate(undefined, { onSuccess: () => setPlaying(true), onError: error => toast.push(formatError(error), 'error') })
  }
  // A live moment the player chose to take starts straight away, once.
  useEffect(() => {
    if (!started || asked.current || startedTicket)
      return
    asked.current = true
    onStart?.()
    start.mutate(undefined, { onSuccess: () => setPlaying(true), onError: error => toast.push(formatError(error), 'error') })
  })

  if (playing && ticket?.cabinet) {
    const Game = cabinetGame(CHANCE_CABINET[chance.kind])
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-primary">{`${CHANCE_NAME[chance.kind]}!`}</h3>
        {finish.isPending ? <span className="text-muted">Checking…</span> : null}
        <PlayTuning ticket={ticket}>
          <Game
            key={ticket.id}
            seed={ticket.seed}
            onFinish={taps => finish.mutate(taps, {
              onSuccess: (response) => {
                play(response.scored ? (chance.kind === 'save' ? 'perfect' : 'goal') : 'error')
                if (response.promotedTo)
                  setTimeout(() => play('promoted'), 900)
                setResult(response)
                setPlaying(false)
              },
              onError: (error) => {
                toast.push(formatError(error), 'error')
                setPlaying(false)
                onDone(null)
              },
            })}
          />
        </PlayTuning>
      </div>
    )
  }

  if (result) {
    const word = chance.kind === 'save' ? (result.scored ? 'Saved!' : 'It went in.') : (result.scored ? 'Scored!' : 'Missed.')
    return (
      <div className="flex flex-col items-center gap-3 border-2 border-primary bg-base-100 p-4 text-center" aria-label="Moment result">
        <span className={`font-display text-lg ${result.scored ? 'text-success' : 'text-muted'}`} role="status">{word}</span>
        {result.scored
          ? (
              <>
                <span className="text-lg tabular-nums">{`Now ${result.goalsFor}–${result.goalsAgainst}${result.after !== result.before ? `: the ${result.before} is a ${result.after}.` : '.'}`}</span>
                {result.points > 0 || result.coins > 0 ? <span>{[result.points > 0 ? `+${result.points} ${result.points === 1 ? 'point' : 'points'}` : null, result.coins > 0 ? `+${result.coins} coins` : null].filter(Boolean).join(' · ')}</span> : null}
                {result.points === 0 && result.coins > 0 ? <span className="text-sm text-muted">Coins only: your club has moved up a league since.</span> : null}
                {result.promotedTo ? <span className="text-primary">{`Promoted to ${leagueName(result.promotedTo)}!`}</span> : null}
              </>
            )
          : <span className="text-muted">No harm done: the result stands.</span>}
        <button type="button" className="btn btn-primary min-h-12 w-full" onClick={() => onDone(result)}>Continue</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-primary">{`${CHANCE_NAME[chance.kind]} · ${leagueName(chance.tier)} match ${chance.fixtureNo + 1}`}</h3>
      <span className="text-lg">{chanceStakes(chance)}</span>
      <span>{chanceHow(chance.kind, config.moments.freeKickPoints)}</span>
      <span className="text-sm text-muted">One try, and it is free. Missing costs nothing.</span>
      <button type="button" className="btn btn-accent min-h-12 font-display text-xs" disabled={start.isPending} onClick={begin}>{`Take the ${CHANCE_NAME[chance.kind].toLowerCase()}`}</button>
    </div>
  )
}

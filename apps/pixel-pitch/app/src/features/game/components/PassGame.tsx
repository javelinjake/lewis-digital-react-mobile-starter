import { passLength, passSequence } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

type Phase = 'show' | 'input' | 'right' | 'wrong'
const COLOURS = ['bg-error', 'bg-info', 'bg-warning', 'bg-success', 'bg-secondary', 'bg-accent']

/**
 * Pass Master: the ball goes round the players; repeat the order. A pass longer every round, one mistake ends it. The
 * players tapped in each round are sent, and the server checks them against the move drawn from the seed.
 */
export function PassGame({ seed, onFinish }: { seed: string, onFinish: (rounds: number[][]) => void }) {
  const config = useGameConfig()
  /** The parent's handler, called from the timers without restarting them when it changes. */
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  const { players, rounds, showMs, gapMs } = config.minigames.pass
  const sequence = useMemo(() => passSequence(seed, config), [seed, config])
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('show')
  /** While showing: which half-step of the move is on screen (even steps light a player, odd steps are a gap). */
  const [step, setStep] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  /** How many passes of this round the player has repeated so far. */
  const [position, setPosition] = useState(0)
  const picks = useRef<number[][]>([[]])
  const length = passLength(round, config)
  const done = phase === 'right' ? round + 1 : round

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (phase === 'show') {
      timer = setTimeout(() => {
        if (step + 1 >= length * 2)
          setPhase('input')
        else
          setStep(step + 1)
      }, step % 2 === 0 ? showMs : gapMs)
    }
    else if (phase === 'right') {
      timer = setTimeout(() => {
        if (round + 1 >= rounds) {
          finishRef.current(picks.current)
          return
        }
        picks.current.push([])
        setRound(round + 1)
        setStep(0)
        setPressed(null)
        setPosition(0)
        setPhase('show')
      }, 700)
    }
    else if (phase === 'wrong') {
      timer = setTimeout(() => finishRef.current(picks.current), 900)
    }
    return () => clearTimeout(timer)
  }, [phase, step, round, length, rounds, showMs, gapMs])

  const lit = phase === 'show' && step % 2 === 0 ? sequence[step / 2] : pressed

  const tap = (player: number) => {
    if (phase !== 'input')
      return
    const current = picks.current[round]
    current.push(player)
    setPressed(player)
    setPosition(current.length)
    if (player !== sequence[current.length - 1])
      setPhase('wrong')
    else if (current.length === length)
      setPhase('right')
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Round ${round + 1} of ${rounds} · ${length} passes`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${done} done`}</span>
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        {Array.from({ length: players }, (_, player) => (
          <button
            key={player}
            type="button"
            aria-label={`Player ${player + 1}`}
            aria-pressed={lit === player}
            className={`h-28 border-4 ${COLOURS[player % COLOURS.length]} ${lit === player ? 'border-base-content opacity-100' : 'border-transparent opacity-35'}`}
            onPointerDown={() => tap(player)}
          />
        ))}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {phase === 'show'
          ? <span className="text-muted">Watch…</span>
          : phase === 'input'
            ? <span className="text-primary">{`Your turn: ${position} of ${length}`}</span>
            : phase === 'right' ? <span className="text-success">Got it!</span> : <span className="text-error">Wrong pass!</span>}
      </div>
    </div>
  )
}

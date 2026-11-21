import { useEffect, useMemo, useRef, useState } from 'react'
import { PASS_PLAYERS, PASS_ROUNDS, PASS_START, passSequence } from '../lib/rules'

type Phase = 'show' | 'input' | 'right' | 'wrong'
const COLOURS = ['bg-error', 'bg-info', 'bg-warning', 'bg-success']
const SHOW_MS = 480
const GAP_MS = 160

/** Pass Master: the ball goes round four players; repeat the order. A pass longer every round, one mistake ends it. */
export function PassGame({ seed, onFinish }: { seed: string, onFinish: (score: number) => void }) {
  const sequence = useMemo(() => passSequence(seed), [seed])
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('show')
  /** While showing: which half-step of the move is on screen (even steps light a player, odd steps are a gap). */
  const [step, setStep] = useState(0)
  const [position, setPosition] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  const done = useRef(0)
  const length = PASS_START + round

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (phase === 'show') {
      timer = setTimeout(() => {
        if (step + 1 >= length * 2)
          setPhase('input')
        else
          setStep(step + 1)
      }, step % 2 === 0 ? SHOW_MS : GAP_MS)
    }
    else if (phase === 'right') {
      timer = setTimeout(() => {
        if (round + 1 >= PASS_ROUNDS) {
          onFinish(done.current)
          return
        }
        setRound(round + 1)
        setStep(0)
        setPosition(0)
        setPressed(null)
        setPhase('show')
      }, 700)
    }
    else if (phase === 'wrong') {
      timer = setTimeout(() => onFinish(done.current), 900)
    }
    return () => clearTimeout(timer)
  }, [phase, step, round, length, onFinish])

  const lit = phase === 'show' && step % 2 === 0 ? sequence[step / 2] : pressed

  const tap = (player: number) => {
    if (phase !== 'input')
      return
    setPressed(player)
    if (player !== sequence[position]) {
      setPhase('wrong')
      return
    }
    if (position + 1 === length) {
      done.current = round + 1
      setPhase('right')
    }
    else {
      setPosition(position + 1)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Round ${round + 1} of ${PASS_ROUNDS} · ${length} passes`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${done.current} done`}</span>
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        {Array.from({ length: PASS_PLAYERS }, (_, player) => (
          <button
            key={player}
            type="button"
            aria-label={`Player ${player + 1}`}
            aria-pressed={lit === player}
            className={`h-28 border-4 ${COLOURS[player]} ${lit === player ? 'border-base-content opacity-100' : 'border-transparent opacity-35'}`}
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

import { ballSlot, coneRound } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

type Phase = 'reveal' | 'shuffle' | 'pick' | 'right' | 'wrong'

/**
 * Cone Shuffle: the ball is shown under a cone, the cones swap places, pick the one with the ball. The slot picked in
 * each round is sent, and the server follows the ball through the swaps drawn from the seed.
 */
export function ConeGame({ seed, onFinish }: { seed: string, onFinish: (picks: number[]) => void }) {
  const config = useGameConfig()
  /** The parent's handler, called from the timers without restarting them when it changes. */
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  const { cones, rounds, revealMs } = config.minigames.cones
  const start = useMemo(() => Array.from({ length: cones }, (_, cone) => cone), [cones])
  const slotPosition = (slot: number) => `${((slot + 0.5) / cones) * 100}%`
  const [roundNo, setRoundNo] = useState(0)
  const round = useMemo(() => coneRound(seed, roundNo, config), [seed, roundNo, config])
  const [phase, setPhase] = useState<Phase>('reveal')
  /** Which slot each cone is in. Cone `round.ball` starts over the ball and keeps it. */
  const [slots, setSlots] = useState(start)
  const [swap, setSwap] = useState(0)
  const [right, setRight] = useState(0)
  const picks = useRef<number[]>([])

  useEffect(() => {
    if (phase === 'pick')
      return
    const next = () => {
      if (phase === 'reveal') {
        setPhase('shuffle')
      }
      else if (phase === 'shuffle') {
        if (swap >= round.swaps.length) {
          setPhase('pick')
          return
        }
        const [a, b] = round.swaps[swap]
        setSlots(current => current.map(slot => (slot === a ? b : slot === b ? a : slot)))
        setSwap(swap + 1)
      }
      else if (roundNo + 1 >= rounds) {
        finishRef.current(picks.current)
      }
      else {
        setRoundNo(roundNo + 1)
        setSlots(start)
        setSwap(0)
        setPhase('reveal')
      }
    }
    const wait = phase === 'shuffle' ? (swap === 0 ? 350 : round.swapMs + 60) : revealMs
    const timer = setTimeout(next, wait)
    return () => clearTimeout(timer)
  }, [phase, swap, round, roundNo, rounds, revealMs, start])

  const pick = (cone: number) => {
    if (phase !== 'pick')
      return
    picks.current.push(slots[cone])
    if (slots[cone] === ballSlot(round)) {
      setRight(current => current + 1)
      setPhase('right')
    }
    else {
      setPhase('wrong')
    }
  }

  const lifted = phase === 'reveal' || phase === 'right' || phase === 'wrong'
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Round ${roundNo + 1} of ${rounds} · ${round.swaps.length} swaps`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${right} right`}</span>
      </div>
      <div className="relative h-56 w-full border-2 border-slate bg-success/30">
        {start.map((cone) => {
          const hasBall = cone === round.ball
          return (
            <div key={`${roundNo}-${cone}`} className="absolute bottom-6 w-1/4 -translate-x-1/2" style={{ left: slotPosition(slots[cone]), transition: phase === 'shuffle' ? `left ${round.swapMs}ms linear` : 'none' }}>
              {hasBall && lifted ? <div className="absolute bottom-0 left-1/2 size-6 -translate-x-1/2 rounded-full bg-base-content" aria-label="The ball" /> : null}
              <button
                type="button"
                aria-label={`Cone ${slots[cone] + 1}`}
                disabled={phase !== 'pick'}
                className="block h-28 w-full bg-warning"
                style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)', transform: lifted && hasBall ? 'translateY(-45%)' : 'none', transition: 'transform 200ms steps(4)' }}
                onPointerDown={() => pick(cone)}
              />
            </div>
          )
        })}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {phase === 'reveal'
          ? <span className="text-muted">Watch the ball…</span>
          : phase === 'shuffle'
            ? <span className="text-muted">Keep watching…</span>
            : phase === 'pick' ? <span className="text-primary">Which cone?</span> : phase === 'right' ? <span className="text-success">Got it!</span> : <span className="text-error">Not that one</span>}
      </div>
    </div>
  )
}

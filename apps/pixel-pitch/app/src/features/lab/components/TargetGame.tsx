import { useEffect, useMemo, useRef, useState } from 'react'
import { targetSpots } from '../lib/rules'

type Phase = 'show' | 'hit' | 'miss'

/** Target Practice: a target shows for a moment somewhere in the goal. Tap it. A tap anywhere else loses it. */
export function TargetGame({ seed, onFinish }: { seed: string, onFinish: (score: number) => void }) {
  const targets = useMemo(() => targetSpots(seed), [seed])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('show')
  const hits = useRef(0)
  const target = targets[index]

  useEffect(() => {
    const timer = phase === 'show'
      ? setTimeout(() => setPhase('miss'), target.lifeMs)
      : setTimeout(() => {
          if (index + 1 < targets.length) {
            setIndex(index + 1)
            setPhase('show')
          }
          else {
            onFinish(hits.current)
          }
        }, 380)
    return () => clearTimeout(timer)
  }, [phase, index, target, targets.length, onFinish])

  const hit = () => {
    if (phase !== 'show')
      return
    hits.current += 1
    setPhase('hit')
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Target ${index + 1} of ${targets.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${hits.current} hit`}</span>
      </div>
      <div
        className="relative h-80 w-full touch-none border-x-4 border-t-4 border-base-content bg-success/30"
        role="group"
        aria-label="The goal"
        onPointerDown={() => phase === 'show' && setPhase('miss')}
      >
        {phase === 'miss'
          ? null
          : (
              <button
                key={index}
                type="button"
                aria-label="Target"
                className={`absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${phase === 'hit' ? 'border-success bg-success' : 'border-base-content bg-error'}`}
                style={{ left: `${target.x}%`, top: `${target.y}%`, animation: 'pp-pop 120ms steps(3)' }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  hit()
                }}
              >
                <span className="absolute inset-3 rounded-full bg-base-content" />
              </button>
            )}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {phase === 'hit' ? <span className="text-success">Hit!</span> : phase === 'miss' ? <span className="text-error">Missed</span> : <span className="text-muted">Tap the target</span>}
      </div>
    </div>
  )
}

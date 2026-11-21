import type { Side } from '../lib/rules'
import { useEffect, useMemo, useRef, useState } from 'react'
import { keeperShots, SIDES } from '../lib/rules'

type Phase = 'wait' | 'shot' | 'saved' | 'goal'
const LABEL: Record<Side, string> = { left: 'Left', centre: 'Centre', right: 'Right' }
const AT: Record<Side, string> = { left: '17%', centre: '50%', right: '83%' }

/** Keeper Reflex: a shot comes at one side after a wait; dive that way before it is in. Diving early is a goal. */
export function KeeperGame({ seed, onFinish }: { seed: string, onFinish: (score: number) => void }) {
  const shots = useMemo(() => keeperShots(seed), [seed])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('wait')
  const [dived, setDived] = useState<Side | null>(null)
  const saves = useRef(0)
  const shot = shots[index]

  useEffect(() => {
    const timer = phase === 'wait'
      ? setTimeout(() => setPhase('shot'), shot.delayMs)
      : phase === 'shot'
        ? setTimeout(() => setPhase('goal'), shot.windowMs)
        : setTimeout(() => {
            if (index + 1 < shots.length) {
              setIndex(index + 1)
              setDived(null)
              setPhase('wait')
            }
            else {
              onFinish(saves.current)
            }
          }, 750)
    return () => clearTimeout(timer)
  }, [phase, index, shot, shots.length, onFinish])

  const dive = (side: Side) => {
    if (phase !== 'wait' && phase !== 'shot')
      return
    setDived(side)
    // A dive before the shot is a guess, and the striker goes the other way.
    if (phase === 'shot' && side === shot.side) {
      saves.current += 1
      setPhase('saved')
    }
    else {
      setPhase('goal')
    }
  }

  const struck = phase !== 'wait'
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Shot ${index + 1} of ${shots.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${saves.current} saved`}</span>
      </div>
      <div className="relative h-44 w-full border-x-4 border-t-4 border-base-content bg-success/30" role="img" aria-label="The goal">
        {dived ? <div className="absolute bottom-0 h-16 w-1/4 -translate-x-1/2 bg-info" style={{ left: AT[dived] }} /> : <div className="absolute bottom-0 left-1/2 h-16 w-1/4 -translate-x-1/2 bg-info/60" />}
        {struck ? <div className="absolute top-10 size-8 -translate-x-1/2 bg-base-content" style={{ left: AT[shot.side], animation: 'pp-pop 150ms steps(3)' }} /> : null}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {phase === 'saved' ? <span className="text-success">Saved!</span> : phase === 'goal' ? <span className="text-error">{dived && !struck ? 'Too early!' : 'Goal!'}</span> : phase === 'wait' ? <span className="text-muted">Wait for it…</span> : null}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {SIDES.map(side => (
          <button key={side} type="button" className="btn btn-primary h-20 font-display text-xs" onPointerDown={() => dive(side)}>{LABEL[side]}</button>
        ))}
      </div>
    </div>
  )
}

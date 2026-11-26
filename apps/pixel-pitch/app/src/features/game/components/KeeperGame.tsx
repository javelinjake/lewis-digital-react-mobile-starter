import type { DiveSide, KeeperDive, KeeperOutcome } from '@ld/pixel-pitch-core'
import { DIVE_SIDES, keeperOutcome, keeperShots } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

type Phase = 'wait' | 'shot' | 'done'
const LABEL: Record<DiveSide, string> = { left: 'Left', centre: 'Centre', right: 'Right' }
const AT: Record<DiveSide, string> = { left: '17%', centre: '50%', right: '83%' }
const VERDICT: Record<KeeperOutcome, string> = { saved: 'Saved!', early: 'Too early!', wrong: 'Goal!', late: 'Goal!' }
const FEEDBACK_MS = 750

/**
 * Keeper Reflex: a shot comes at one side after a wait; dive that way before it is in. Diving early is a goal. Each
 * dive is sent with when it came (milliseconds into its round), and the server works out the saves from the seed.
 */
export function KeeperGame({ seed, onFinish }: { seed: string, onFinish: (dives: Array<KeeperDive | null>) => void }) {
  const config = useGameConfig()
  const shots = useMemo(() => keeperShots(seed, config), [seed, config])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('wait')
  const [outcome, setOutcome] = useState<KeeperOutcome | null>(null)
  const [dived, setDived] = useState<DiveSide | null>(null)
  const [saves, setSaves] = useState(0)
  const startedAt = useRef(performance.now())
  const dives = useRef<Array<KeeperDive | null>>([])
  const shot = shots[index]

  const settle = (dive: KeeperDive | null) => {
    if (dives.current.length > index)
      return
    dives.current.push(dive)
    const result = keeperOutcome(shot, dive, config)
    setOutcome(result)
    setDived(dive?.side ?? null)
    if (result === 'saved')
      setSaves(current => current + 1)
    setPhase('done')
  }

  useEffect(() => {
    const elapsed = performance.now() - startedAt.current
    const timer = phase === 'wait'
      ? setTimeout(() => setPhase('shot'), shot.delayMs - elapsed)
      : phase === 'shot'
        ? setTimeout(() => settle(null), shot.delayMs + shot.windowMs - elapsed)
        : setTimeout(() => {
            if (index + 1 < shots.length) {
              startedAt.current = performance.now()
              setIndex(index + 1)
              setDived(null)
              setOutcome(null)
              setPhase('wait')
            }
            else {
              onFinish(dives.current)
            }
          }, FEEDBACK_MS)
    return () => clearTimeout(timer)
  })

  const dive = (side: DiveSide) => {
    if (phase === 'done')
      return
    settle({ side, ms: Math.round(performance.now() - startedAt.current) })
  }

  const struck = phase !== 'wait' && outcome !== 'early'
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Shot ${index + 1} of ${shots.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${saves} saved`}</span>
      </div>
      <div className="relative h-44 w-full border-x-4 border-t-4 border-base-content bg-success/30" role="img" aria-label="The goal">
        {dived ? <div className="absolute bottom-0 h-16 w-1/4 -translate-x-1/2 bg-info" style={{ left: AT[dived] }} /> : <div className="absolute bottom-0 left-1/2 h-16 w-1/4 -translate-x-1/2 bg-info/60" />}
        {struck ? <div className="absolute top-10 size-8 -translate-x-1/2 bg-base-content" style={{ left: AT[shot.side], animation: 'pp-pop 150ms steps(3)' }} /> : null}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {outcome ? <span className={outcome === 'saved' ? 'text-success' : 'text-error'}>{VERDICT[outcome]}</span> : phase === 'wait' ? <span className="text-muted">Wait for it…</span> : null}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {DIVE_SIDES.map(side => (
          <button key={side} type="button" className="btn btn-primary h-20 font-display text-xs" onPointerDown={() => dive(side)}>{LABEL[side]}</button>
        ))}
      </div>
    </div>
  )
}

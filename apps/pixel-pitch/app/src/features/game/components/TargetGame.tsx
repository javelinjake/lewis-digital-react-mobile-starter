import type { TargetTap } from '@ld/pixel-pitch-core'
import type { PointerEvent } from 'react'
import { hitsTarget, targetSpots } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

type Phase = 'show' | 'hit' | 'miss'
const FEEDBACK_MS = 380

/**
 * Target Practice: a target shows for a moment somewhere in the goal. Tap it. A tap anywhere else loses it. Each tap
 * is sent with when (after the target appeared) and where it landed in the goal, and the server works out the hits.
 */
export function TargetGame({ seed, onFinish }: { seed: string, onFinish: (taps: Array<TargetTap | null>) => void }) {
  const config = useGameConfig()
  const { width, height, radius } = config.minigames.targets
  const targets = useMemo(() => targetSpots(seed, config), [seed, config])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('show')
  const [hits, setHits] = useState(0)
  const shownAt = useRef(performance.now())
  const taps = useRef<Array<TargetTap | null>>([])
  const target = targets[index]

  const settle = (tap: TargetTap | null) => {
    if (taps.current.length > index)
      return
    taps.current.push(tap)
    const hit = hitsTarget(target, tap, config)
    if (hit)
      setHits(current => current + 1)
    setPhase(hit ? 'hit' : 'miss')
  }

  useEffect(() => {
    const timer = phase === 'show'
      ? setTimeout(() => settle(null), target.lifeMs - (performance.now() - shownAt.current))
      : setTimeout(() => {
          if (index + 1 < targets.length) {
            shownAt.current = performance.now()
            setIndex(index + 1)
            setPhase('show')
          }
          else {
            onFinish(taps.current)
          }
        }, FEEDBACK_MS)
    return () => clearTimeout(timer)
  })

  const tap = (at: { x: number, y: number }) => {
    if (phase !== 'show')
      return
    const ms = Math.round(performance.now() - shownAt.current)
    // Quicker than anyone can see the target: the server would refuse it, so it does not count either way.
    if (ms < config.minigames.minTapGapMs)
      return
    settle({ ms, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100 })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0)
      tap({ x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Target ${index + 1} of ${targets.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${hits} hit`}</span>
      </div>
      <div
        className="relative w-full touch-none border-x-4 border-t-4 border-base-content bg-success/30"
        style={{ aspectRatio: `${width} / ${height}` }}
        role="group"
        aria-label="The goal"
        onPointerDown={onPointerDown}
      >
        {phase === 'miss'
          ? null
          : (
              <button
                key={index}
                type="button"
                aria-label="Target"
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${phase === 'hit' ? 'border-success bg-success' : 'border-base-content bg-error'}`}
                style={{ left: `${(target.x / width) * 100}%`, top: `${(target.y / height) * 100}%`, width: `${((radius * 2) / width) * 100}%`, aspectRatio: '1', animation: 'pp-pop 120ms steps(3)' }}
                // A tap is placed by the goal around it. From a keyboard (no pointer), Enter or Space hits the middle.
                onClick={event => event.detail === 0 && tap(target)}
              >
                <span className="absolute inset-[30%] rounded-full bg-base-content" />
              </button>
            )}
      </div>
      <div className="h-8 font-display text-sm" aria-live="polite">
        {phase === 'hit' ? <span className="text-success">Hit!</span> : phase === 'miss' ? <span className="text-error">Missed</span> : <span className="text-muted">Tap the target</span>}
      </div>
    </div>
  )
}

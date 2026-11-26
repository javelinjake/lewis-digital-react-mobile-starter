import type { LaneMove } from '@ld/pixel-pitch-core'
import { defenderProgress, defendersBeaten, dribbleEndMs, dribbleRun, dribbleTackle, startLane } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

/**
 * Dribble Dash: defenders come down the lanes; switch lane to go round them. One tackle ends the run. The lane changes
 * are sent with when they came, and the server works out the tackle from them, the same sum the game uses here.
 */
export function DribbleGame({ seed, onFinish }: { seed: string, onFinish: (moves: LaneMove[]) => void }) {
  const config = useGameConfig()
  /** The parent's handler, called from the timers without restarting them when it changes. */
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  const { lanes, tackleFrom } = config.minigames.dribble
  const defenders = useMemo(() => dribbleRun(seed, config), [seed, config])
  const [elapsed, setElapsed] = useState(0)
  const [lane, setLane] = useState(() => startLane(config))
  const [tackled, setTackled] = useState(false)
  const moves = useRef<LaneMove[]>([])
  const laneRef = useRef(startLane(config))
  const startedAt = useRef(performance.now())
  const finished = useRef(false)
  const lanePosition = (at: number) => `${((at + 0.5) / lanes) * 100}%`

  useEffect(() => {
    startedAt.current = performance.now()
    const end = dribbleEndMs(defenders)
    let frame = 0
    let ending: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const ms = performance.now() - startedAt.current
      setElapsed(ms)
      const hit = dribbleTackle(defenders, moves.current, config, ms)
      if ((hit || ms > end) && !finished.current) {
        finished.current = true
        setTackled(Boolean(hit))
        ending = setTimeout(() => finishRef.current(moves.current), 800)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(ending)
    }
  }, [defenders, config])

  const move = (by: number) => {
    if (finished.current)
      return
    const next = laneRef.current + by
    const ms = Math.round(performance.now() - startedAt.current)
    const last = moves.current.at(-1)
    // Off the pitch, or quicker than the server takes from a person: not a move.
    if (next < 0 || next >= lanes || (last && ms - last.ms < config.minigames.minTapGapMs))
      return
    moves.current.push({ ms, lane: next })
    laneRef.current = next
    setLane(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft')
        move(-1)
      if (event.code === 'ArrowRight')
        move(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onPitch = defenders.filter((defender) => {
    const progress = defenderProgress(defender, elapsed)
    return progress >= 0 && progress <= 1.1
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{tackled ? 'Tackled!' : 'Keep going'}</span>
        <span className="font-display text-xs text-primary tabular-nums" aria-live="polite">{`${defendersBeaten(defenders, elapsed, config)} of ${defenders.length} beaten`}</span>
      </div>
      <div className="relative h-80 w-full overflow-hidden border-2 border-slate bg-success/30" role="img" aria-label="The pitch">
        {Array.from({ length: lanes - 1 }, (_, line) => (
          <div key={line} className="absolute inset-y-0 w-px bg-base-content/20" style={{ left: `${((line + 1) / lanes) * 100}%` }} />
        ))}
        {onPitch.map(defender => (
          <div key={defender.atMs} className="absolute size-8 -translate-x-1/2 -translate-y-1/2 bg-error" style={{ left: lanePosition(defender.lane), top: `${(defenderProgress(defender, elapsed) / tackleFrom) * 82}%` }} />
        ))}
        <div className={`absolute size-8 -translate-x-1/2 -translate-y-1/2 ${tackled ? 'bg-warning' : 'bg-info'}`} style={{ left: lanePosition(lane), top: '86%', transition: 'left 90ms steps(3)' }} aria-label={`You, in lane ${lane + 1}`} />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary h-20 font-display text-lg" aria-label="Move left" onPointerDown={() => move(-1)}>◀</button>
        <button type="button" className="btn btn-primary h-20 font-display text-lg" aria-label="Move right" onPointerDown={() => move(1)}>▶</button>
      </div>
    </div>
  )
}

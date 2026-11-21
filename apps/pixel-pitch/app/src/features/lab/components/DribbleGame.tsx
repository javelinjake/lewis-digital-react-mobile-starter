import { useEffect, useMemo, useRef, useState } from 'react'
import { defenderProgress, defendersBeaten, DRIBBLE_LANES, dribbleRun, TACKLE_FROM, tackledBy } from '../lib/rules'

const lanePosition = (lane: number) => `${((lane + 0.5) / DRIBBLE_LANES) * 100}%`

/** Dribble Dash: defenders come down three lanes; switch lane to go round them. One tackle ends the run. */
export function DribbleGame({ seed, onFinish }: { seed: string, onFinish: (score: number) => void }) {
  const defenders = useMemo(() => dribbleRun(seed), [seed])
  const [elapsed, setElapsed] = useState(0)
  const [lane, setLane] = useState(1)
  const [tackled, setTackled] = useState(false)
  const laneRef = useRef(1)
  const finished = useRef(false)

  useEffect(() => {
    const started = performance.now()
    const last = defenders.at(-1)!
    let frame = 0
    let ending: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const ms = performance.now() - started
      setElapsed(ms)
      const hit = tackledBy(defenders, laneRef.current, ms)
      const over = ms > last.atMs + last.fallMs
      if ((hit || over) && !finished.current) {
        finished.current = true
        setTackled(Boolean(hit))
        ending = setTimeout(() => onFinish(defendersBeaten(defenders, ms)), 800)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(ending)
    }
  }, [defenders, onFinish])

  const move = (by: number) => {
    if (finished.current)
      return
    const next = Math.max(0, Math.min(DRIBBLE_LANES - 1, laneRef.current + by))
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
  }, [])

  const onPitch = defenders.filter((defender) => {
    const progress = defenderProgress(defender, elapsed)
    return progress >= 0 && progress <= 1.1
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{tackled ? 'Tackled!' : 'Keep going'}</span>
        <span className="font-display text-xs text-primary tabular-nums" aria-live="polite">{`${defendersBeaten(defenders, elapsed)} beaten`}</span>
      </div>
      <div className="relative h-80 w-full overflow-hidden border-2 border-slate bg-success/30" role="img" aria-label="The pitch">
        {Array.from({ length: DRIBBLE_LANES - 1 }, (_, line) => (
          <div key={line} className="absolute inset-y-0 w-px bg-base-content/20" style={{ left: `${((line + 1) / DRIBBLE_LANES) * 100}%` }} />
        ))}
        {onPitch.map(defender => (
          <div key={defender.atMs} className="absolute size-8 -translate-x-1/2 -translate-y-1/2 bg-error" style={{ left: lanePosition(defender.lane), top: `${(defenderProgress(defender, elapsed) / TACKLE_FROM) * 82}%` }} />
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

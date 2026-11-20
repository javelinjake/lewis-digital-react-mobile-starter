import type { PenaltyOutcome } from '@ld/pixel-pitch-core'
import { keeperAt, markerAt, penaltyRounds, penaltyShot } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'

/** A tap sooner than this after the round starts is ignored: nobody can mean it, and the server refuses it. */
const MIN_TAP_MS = 150
const FEEDBACK_MS = 1000

const VERDICT: Record<PenaltyOutcome, string> = { wide: 'Wide!', saved: 'Saved!', goal: 'Goal!', corner: 'Top corner! 2 points' }
const TONE: Record<PenaltyOutcome, string> = { wide: 'text-error', saved: 'text-error', goal: 'text-success', corner: 'text-success' }

/**
 * Penalty Shootout: five penalties. An aim sweeps across the goal and the keeper shuffles along the line; tap to
 * shoot. Wide of the posts or into the keeper's reach scores nothing, a goal 1, the corners 2. The keeper drawn here is
 * exactly as wide as the reach that saves a shot, so what you see is what counts. Scored by the server from the
 * milliseconds each tap came after its round began, with the game's seed.
 */
export function PenaltyGame({ seed, onFinish }: { seed: string, onFinish: (taps: number[]) => void }) {
  const config = useGameConfig()
  const { pens } = config.minigames
  const rounds = useMemo(() => penaltyRounds(seed, config), [seed, config])
  const [round, setRound] = useState(0)
  const [shot, setShot] = useState<ReturnType<typeof penaltyShot> | null>(null)
  const [total, setTotal] = useState(0)
  const startedAt = useRef(performance.now())
  const taps = useRef<number[]>([])
  const aim = useRef<HTMLDivElement>(null)
  const keeper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shot)
      return
    const paint = () => {
      const ms = performance.now() - startedAt.current
      if (aim.current)
        aim.current.style.left = `${markerAt(rounds[round].aim, ms) * 100}%`
      if (keeper.current)
        keeper.current.style.left = `${(keeperAt(rounds[round], ms) - pens.reach) * 100}%`
    }
    let frame = 0
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [round, rounds, shot, pens.reach])

  const shoot = () => {
    if (shot)
      return
    const ms = Math.round(performance.now() - startedAt.current)
    if (ms < MIN_TAP_MS)
      return
    const result = penaltyShot(rounds[round], ms, config)
    taps.current.push(ms)
    // Freeze both exactly where the shot was taken.
    if (aim.current)
      aim.current.style.left = `${result.aim * 100}%`
    if (keeper.current)
      keeper.current.style.left = `${(result.keeper - pens.reach) * 100}%`
    setShot(result)
    setTotal(current => current + result.points)
    setTimeout(() => {
      if (round + 1 < rounds.length) {
        startedAt.current = performance.now()
        setRound(round + 1)
        setShot(null)
      }
      else {
        onFinish(taps.current)
      }
    }, FEEDBACK_MS)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Penalty ${round + 1} of ${rounds.length}${round === rounds.length - 1 ? ' · last' : ''}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${total} pts`}</span>
      </div>

      <div className="relative h-44 w-full overflow-hidden border-2 border-slate bg-success/30" role="img" aria-label="The goal, with the keeper and your aim">
        {/* The goal mouth, between the posts; the corners are worth double. */}
        <div className="absolute inset-y-3 border-x-4 border-t-4 border-base-content" style={{ left: `${pens.post * 100}%`, right: `${pens.post * 100}%` }} />
        <div className="absolute inset-y-3 bg-warning/25" style={{ left: `${pens.post * 100}%`, width: `${(pens.corner - pens.post) * 100}%` }} />
        <div className="absolute inset-y-3 bg-warning/25" style={{ right: `${pens.post * 100}%`, width: `${(pens.corner - pens.post) * 100}%` }} />
        <div ref={keeper} className="absolute bottom-10 top-10 bg-info" style={{ width: `${pens.reach * 200}%`, left: '40%' }}>
          <div className="absolute -left-1 top-2 size-3 bg-warning" />
          <div className="absolute -right-1 top-2 size-3 bg-warning" />
        </div>
        <div ref={aim} className="absolute inset-y-3 w-1 -translate-x-1/2 bg-error" style={{ left: '0%' }} />
        <div
          className="absolute size-4 -translate-x-1/2 bg-base-content"
          style={{
            left: shot ? `${shot.aim * 100}%` : '50%',
            bottom: shot ? '55%' : '0.4rem',
            transition: shot ? 'left 350ms steps(6), bottom 350ms steps(6)' : 'none',
          }}
        />
      </div>

      <div className="h-8 font-display text-sm" aria-live="polite">
        {shot ? <span className={TONE[shot.outcome]}>{VERDICT[shot.outcome]}</span> : <span className="text-muted">Aim for a corner, away from the keeper</span>}
      </div>
      <button type="button" className="btn btn-primary h-20 w-full font-display text-lg" onPointerDown={shoot} disabled={shot !== null}>SHOOT!</button>
      <span className="text-muted">Tap to shoot. The yellow corners are worth 2. The blue keeper saves anything under them.</span>
    </div>
  )
}

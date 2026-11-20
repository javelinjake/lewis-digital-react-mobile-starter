import { kickPoints, kickRounds, markerAt } from '@ld/pixel-pitch-core'
import { useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'
import { TimingBar } from './TimingBar'

const VERDICT = ['Miss', 'Close', 'Good', 'Perfect!']
/** A tap sooner than this after the round starts is ignored: nobody can mean it, and the server refuses it. */
const MIN_TAP_MS = 150
const FEEDBACK_MS = 800

/**
 * Kick Timer: five kicks. Stop the marker in the target. Scored by the server from the milliseconds each tap came
 * after its round began, with the game's seed; what the player sees here is only the same maths, run early.
 */
export function KickTimerGame({ seed, onFinish }: { seed: string, onFinish: (taps: number[]) => void }) {
  const config = useGameConfig()
  const rounds = useMemo(() => kickRounds(seed, config), [seed, config])
  const { perfect, good, ok } = config.minigames.kick
  const [round, setRound] = useState(0)
  const [verdict, setVerdict] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const startedAt = useRef(performance.now())
  const taps = useRef<number[]>([])

  const kick = () => {
    if (verdict !== null)
      return
    const ms = Math.round(performance.now() - startedAt.current)
    if (ms < MIN_TAP_MS)
      return
    const bar = rounds[round]
    const points = kickPoints(Math.abs(markerAt(bar, ms) - bar.centre), config)
    taps.current.push(ms)
    setVerdict(points)
    setTotal(current => current + points)
    setTimeout(() => {
      if (round + 1 < rounds.length) {
        startedAt.current = performance.now()
        setRound(round + 1)
        setVerdict(null)
      }
      else {
        onFinish(taps.current)
      }
    }, FEEDBACK_MS)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{`Kick ${round + 1} of ${rounds.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${total} pts`}</span>
      </div>
      <TimingBar
        bar={rounds[round]}
        running={verdict === null}
        startedAt={startedAt}
        zones={[
          { halfWidth: ok, colour: '#3a3f72', label: 'wide' },
          { halfWidth: good, colour: '#3fa34d', label: 'good' },
          { halfWidth: perfect, colour: '#ffd23f', label: 'perfect' },
        ]}
      />
      <div className="h-8 font-display text-sm text-primary" aria-live="polite">{verdict === null ? '' : VERDICT[verdict]}</div>
      <button type="button" className="btn btn-primary h-20 w-full font-display text-lg" onPointerDown={kick} disabled={verdict !== null}>KICK!</button>
      <span className="text-muted">Tap when the marker is in the yellow.</span>
    </div>
  )
}

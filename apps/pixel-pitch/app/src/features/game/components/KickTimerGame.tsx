import type { RoundKind } from '@ld/pixel-pitch-core'
import { kickPoints, kickRounds, markerAt, targetAt } from '@ld/pixel-pitch-core'
import { useMemo, useRef, useState } from 'react'
import { usePlayConfig } from '../queries/use-play-config'
import { TimingBar } from './TimingBar'

const VERDICT = ['Miss', 'Close', 'Good', 'Perfect!']
/** What is different about a round, said before the kick so the player can get ready. */
const TWIST: Record<RoundKind, string> = { steady: '', fast: 'Fast!', narrow: 'Small target!', moving: 'Moving target!' }
/** A tap sooner than this after the round starts is ignored: nobody can mean it, and the server refuses it. */
const MIN_TAP_MS = 150
const FEEDBACK_MS = 800

/**
 * Kick Timer: five kicks. Stop the ball in the target. A round can be fast, have a small target or a moving one, and
 * a kick right after a perfect one counts double. Scored by the server from the milliseconds each tap came after its
 * round began, with the game's seed; what the player sees here is only the same maths, run early.
 */
export function KickTimerGame({ seed, onFinish }: { seed: string, onFinish: (taps: number[]) => void }) {
  const config = usePlayConfig()
  const rounds = useMemo(() => kickRounds(seed, config), [seed, config])
  const { perfect, good, ok } = config.minigames.kick
  const [round, setRound] = useState(0)
  const [verdict, setVerdict] = useState<number | null>(null)
  /** The last kick was perfect, so this one counts double. */
  const [hot, setHot] = useState(false)
  const [doubled, setDoubled] = useState(false)
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
    const points = kickPoints(Math.abs(markerAt(bar, ms) - targetAt(bar, ms)), config, bar.zone)
    taps.current.push(ms)
    setVerdict(points)
    setDoubled(hot)
    setTotal(current => current + (hot ? points * 2 : points))
    setHot(points === 3)
    setTimeout(() => {
      // Endless (the daily challenge): the first miss ends it.
      if (!(config.minigames.endless && points === 0) && round + 1 < rounds.length) {
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
        <span>{config.minigames.endless ? `Kick ${round + 1} · until you miss` : `Kick ${round + 1} of ${rounds.length}${round === rounds.length - 1 ? ' · last' : ''}`}</span>
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
      <div className="flex h-12 flex-col items-center justify-center gap-1" aria-live="polite">
        {verdict === null
          ? <span className="font-display text-sm text-warning">{[TWIST[rounds[round].kind], hot ? 'Hot! Counts double' : ''].filter(Boolean).join(' · ')}</span>
          : <span className="font-display text-sm text-primary">{`${VERDICT[verdict]}${doubled && verdict > 0 ? ' ×2' : ''}`}</span>}
      </div>
      <button type="button" className="btn btn-primary h-20 w-full font-display text-lg" onPointerDown={kick} disabled={verdict !== null}>KICK!</button>
      <span className="text-muted">Tap when the ball is in the yellow.</span>
    </div>
  )
}

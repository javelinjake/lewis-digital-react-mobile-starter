import type { KeepyTap } from '@ld/pixel-pitch-core'
import type { PointerEvent } from 'react'
import { loadImage, useCanvasLoop } from '@ld/game'
import { ballCentre, KEEPY_STEPS_PER_SECOND, keepyMax, keepyScore, newKeepy, nextKickGolden, stepKeepy } from '@ld/pixel-pitch-core'
import { useEffect, useRef, useState } from 'react'
import { play } from '@/lib/sound/sound'
import { art } from '../lib/art'
import { usePlayConfig } from '../queries/use-play-config'

const HEIGHT = 150
const GROUND = 136
/** Pixels on the small canvas for each pitch unit. */
const UNIT = 1.6
/** A second tap this soon after one is not sent: it is far quicker than a person and the server would refuse the lot. */
const MIN_GAP_STEPS = Math.ceil((120 * KEEPY_STEPS_PER_SECOND) / 1000)

/**
 * Keepy-Uppy: the ball falls; tap the ball itself when it is in the shaded zone to kick it up. Each kick sends it off
 * to one side by an amount drawn from the seed, and it bounces off the side walls, so the player has to follow it. It
 * gets faster with every kick, every tenth ball is gold and counts double, and the clock stops the play at 30 seconds.
 * The game runs in fixed 60 Hz steps, the same steps the server replays the recorded taps (step and place) with.
 *
 * With a keyboard, Space taps the middle of the ball wherever it is, so the game is still about timing.
 */
export function KeepyGame({ seed, onFinish }: { seed: string, onFinish: (taps: KeepyTap[]) => void }) {
  const config = usePlayConfig()
  const { keepy } = config.minigames
  const width = Math.round(keepy.width * UNIT)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef(newKeepy(seed, config))
  const taps = useRef<KeepyTap[]>([])
  /** A tap waiting for the next step, where it landed in pitch units. `'ball'` is the keyboard's: on the ball. */
  const pending = useRef<{ x: number, y: number } | 'ball' | null>(null)
  const finished = useRef(false)
  const secondsLeftRef = useRef(keepy.maxSeconds)
  /** Where the last tap landed and on which step, to draw a mark for a moment. */
  const mark = useRef<{ x: number, y: number, step: number, hit: boolean } | null>(null)
  const [kicks, setKicks] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(keepy.maxSeconds)
  const [stumbling, setStumbling] = useState(false)
  const [ball, setBall] = useState<HTMLImageElement[] | null>(null)
  const [shadow, setShadow] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let live = true
    void Promise.all([0, 1, 2, 3].map(frame => loadImage(art(`pitch/ball_${frame}.png`)))).then(images => live && setBall(images))
    void loadImage(art('pitch/ball_shadow.png')).then(image => live && setShadow(image))
    return () => {
      live = false
    }
  }, [])

  const tapAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0)
      return
    const px = ((event.clientX - rect.left) / rect.width) * width
    const py = ((event.clientY - rect.top) / rect.height) * HEIGHT
    pending.current = { x: px / UNIT, y: (GROUND - py) / UNIT }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        pending.current = 'ball'
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useCanvasLoop(canvasRef, {
    paused: !ball || !shadow,
    update: () => {
      if (sim.current.over) {
        if (!finished.current) {
          finished.current = true
          onFinish(taps.current)
        }
        return
      }
      const last = taps.current.at(-1)
      const wanted = pending.current
      pending.current = null
      let tap: KeepyTap | null = null
      if (wanted && (last === undefined || sim.current.step - last.t >= MIN_GAP_STEPS)) {
        const at = wanted === 'ball' ? ballCentre(sim.current, config) : wanted
        // Rounded to a hundredth of a unit, so the taps are short to send; the game uses the rounded place too.
        tap = { t: sim.current.step, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100 }
        taps.current.push(tap)
      }
      const before = sim.current.kicks
      sim.current = stepKeepy(sim.current, tap, config)
      if (tap)
        mark.current = { x: tap.x, y: tap.y, step: sim.current.step, hit: sim.current.kicks !== before }
      if (tap && sim.current.kicks !== before)
        play('kick', 0.7)
      if (sim.current.kicks !== before)
        setKicks(sim.current.kicks)
      const left = Math.ceil(keepy.maxSeconds - sim.current.step / KEEPY_STEPS_PER_SECOND)
      if (left !== secondsLeftRef.current) {
        secondsLeftRef.current = left
        setSecondsLeft(Math.max(0, left))
      }
      if ((sim.current.stumble > 0) !== stumbling)
        setStumbling(sim.current.stumble > 0)
    },
    render: (context) => {
      if (!ball || !shadow)
        return
      const { x, y, step } = sim.current
      const bx = x * UNIT
      const size = keepy.ballRadius * 2 * UNIT
      context.fillStyle = '#1b1f3b'
      context.fillRect(0, 0, width, HEIGHT)
      context.fillStyle = '#3fa34d'
      context.fillRect(0, GROUND, width, HEIGHT - GROUND)
      // The zone where a tap on the ball kicks it.
      context.fillStyle = 'rgba(255, 210, 63, 0.18)'
      context.fillRect(0, GROUND - keepy.reach * UNIT, width, keepy.reach * UNIT)
      context.fillStyle = '#ffd23f'
      context.fillRect(0, GROUND - keepy.reach * UNIT, width, 1)
      const height = Math.min(1, y / 70)
      context.globalAlpha = 1 - height * 0.6
      context.drawImage(shadow, bx - 6 + height * 2, GROUND, 12 - height * 4, 4)
      context.globalAlpha = 1
      // The ball for a golden kick glows.
      if (nextKickGolden(sim.current.kicks, config)) {
        context.fillStyle = `rgba(255, 210, 63, ${0.35 + 0.25 * Math.sin(step / 4)})`
        context.fillRect(bx - size / 2 - 3, GROUND - y * UNIT - size - 3, size + 6, size + 6)
      }
      context.drawImage(ball[Math.floor(step / 5) % 4], bx - size / 2, GROUND - y * UNIT - size, size, size)
      // Where the last tap landed, for a moment: green on the ball, red off it.
      const tapped = mark.current
      if (tapped && step - tapped.step < 12) {
        context.fillStyle = tapped.hit ? '#7ee081' : '#ff4d6d'
        context.fillRect(tapped.x * UNIT - 1, GROUND - tapped.y * UNIT - 1, 3, 3)
      }
      // The clock, along the top: it empties as the 30 seconds run out.
      const used = Math.min(1, step / (keepy.maxSeconds * KEEPY_STEPS_PER_SECOND))
      context.fillStyle = '#2a2f55'
      context.fillRect(0, 0, width, 5)
      context.fillStyle = used > 0.8 ? '#ff4d6d' : '#5bc8ff'
      context.fillRect(0, 0, width * (1 - used), 5)
    },
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-baseline justify-between">
        <span className="tabular-nums">{`${secondsLeft}s`}</span>
        <span className="font-display text-xs text-primary tabular-nums" aria-live="polite">{config.minigames.endless ? String(keepyScore(kicks, config)) : `${keepyScore(kicks, config)} / ${keepyMax(config)}`}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={HEIGHT}
        className={`pixel w-full max-w-xs touch-none border-2 ${stumbling ? 'border-error' : 'border-slate'}`}
        aria-label="Keepy-Uppy game: tap the ball"
        onPointerDown={tapAt}
      />
      <span className="h-6 font-display text-xs" aria-live="polite">{stumbling ? <span className="text-error">Stumble!</span> : null}</span>
      <span className="text-muted">{nextKickGolden(kicks, config) ? 'Gold ball next: it counts double!' : 'Tap the ball when it drops into the shaded zone. Miss it, or tap too early, and you stumble. Space taps the ball for you on a keyboard.'}</span>
    </div>
  )
}

import { loadImage, useCanvasLoop } from '@ld/game'
import { KEEPY_STEPS_PER_SECOND, newKeepy, stepKeepy } from '@ld/pixel-pitch-core'
import { useEffect, useRef, useState } from 'react'
import { art } from '../lib/art'
import { useGameConfig } from '../queries/use-game'

const WIDTH = 120
const HEIGHT = 150
const GROUND = 136
/** Pixels on the small canvas for each pitch unit of height. */
const UNIT = 1.6
/** A second tap this soon after one is not sent: it is far quicker than a person and the server would refuse the lot. */
const MIN_GAP_STEPS = Math.ceil((120 * KEEPY_STEPS_PER_SECOND) / 1000)

/**
 * Keepy-Uppy: the ball falls, tap when it is in the shaded zone at the foot to kick it up. It gets faster with every
 * kick. The game runs in fixed 60 Hz steps, the same steps the server replays the recorded taps with.
 */
export function KeepyGame({ seed, onFinish }: { seed: string, onFinish: (taps: number[]) => void }) {
  const config = useGameConfig()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef(newKeepy(seed))
  const taps = useRef<number[]>([])
  const pending = useRef(false)
  const finished = useRef(false)
  const [kicks, setKicks] = useState(0)
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

  const tap = () => {
    pending.current = true
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        tap()
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
      const wants = pending.current && (last === undefined || sim.current.step - last >= MIN_GAP_STEPS)
      pending.current = false
      if (wants)
        taps.current.push(sim.current.step)
      const before = sim.current.kicks
      sim.current = stepKeepy(sim.current, wants, config)
      if (sim.current.kicks !== before)
        setKicks(sim.current.kicks)
      if ((sim.current.stumble > 0) !== stumbling)
        setStumbling(sim.current.stumble > 0)
    },
    render: (context) => {
      if (!ball || !shadow)
        return
      const { y, step } = sim.current
      context.fillStyle = '#1b1f3b'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      context.fillStyle = '#3fa34d'
      context.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND)
      // The zone where a tap kicks the ball.
      context.fillStyle = 'rgba(255, 210, 63, 0.18)'
      context.fillRect(0, GROUND - config.minigames.keepy.reach * UNIT, WIDTH, config.minigames.keepy.reach * UNIT)
      context.fillStyle = '#ffd23f'
      context.fillRect(0, GROUND - config.minigames.keepy.reach * UNIT, WIDTH, 1)
      const height = Math.min(1, y / 70)
      context.globalAlpha = 1 - height * 0.6
      context.drawImage(shadow, WIDTH / 2 - 6 + height * 2, GROUND, 12 - height * 4, 4)
      context.globalAlpha = 1
      context.drawImage(ball[Math.floor(step / 5) % 4], WIDTH / 2 - 8, GROUND - y * UNIT - 16, 16, 16)
    },
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-baseline justify-between">
        <span>Keep it up</span>
        <span className="font-display text-xs text-primary tabular-nums" aria-live="polite">{`${kicks} / ${config.minigames.keepy.maxKicks}`}</span>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="pixel w-full max-w-xs border-2 border-slate" aria-label="Keepy-Uppy game" onPointerDown={tap} />
      <button type="button" className={`btn h-20 w-full font-display text-lg ${stumbling ? 'btn-error' : 'btn-primary'}`} onPointerDown={tap}>KICK!</button>
      <span className="text-muted">Tap when the ball is in the shaded zone. Too early and you stumble.</span>
    </div>
  )
}

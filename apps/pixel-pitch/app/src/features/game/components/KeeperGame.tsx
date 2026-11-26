import type { KeeperOutcome, KeeperTap } from '@ld/pixel-pitch-core'
import type { PointerEvent } from 'react'
import type { GoalScene } from '../lib/goal-scene'
import type { KeeperPose } from '../lib/goalkeeper-sprite'
import { loadImage, useCanvasLoop } from '@ld/game'
import { keeperBallAt, keeperOutcome, keeperShots } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { play } from '@/lib/sound/sound'
import { art } from '../lib/art'
import { drawGoalFrame, drawGoalScene, drawNetRipple, pointerOnCanvas, toCanvas, toGoal } from '../lib/goal-scene'
import { drawKeeper, KEEPER_HEIGHT } from '../lib/goalkeeper-sprite'
import { drawBall } from '../lib/pixel-sprite'
import { usePlayConfig } from '../queries/use-play-config'

type Phase = 'wait' | 'shot' | 'done'
const VERDICT: Record<KeeperOutcome, string> = { saved: 'Saved!', early: 'Too early!', missed: 'Goal!', late: 'Goal!' }
/** How long the outcome shows once the ball is in (or saved), before the next shot. */
const FEEDBACK_MS = 900
/** A dive that misses takes this long to full stretch; one that saves gets there with the ball. */
const DIVE_MS = 260
const FALL_AFTER_MS = 150
const FALL_MS = 260

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/**
 * Keeper Reflex: you are in goal. After a wait a shot flies from the spot at somewhere in the goal; tap the ball
 * before it crosses the line. A tap is a dive: one a shot, and the keeper goes where you tapped. On the ball is a
 * save; off it, before the shot (or quicker than anyone can react) or too late is a goal. Each tap is sent with when
 * it came (milliseconds into its round) and where (in goal units), and the server works out the saves from the seed.
 * With a keyboard, Space taps the middle of the ball, so it is still about reactions.
 */
export function KeeperGame({ seed, onFinish }: { seed: string, onFinish: (taps: Array<KeeperTap | null>) => void }) {
  const config = usePlayConfig()
  const { keeper } = config.minigames
  const shots = useMemo(() => keeperShots(seed, config), [seed, config])
  const scene = useMemo<GoalScene>(() => {
    const standHeight = 14
    const left = 14
    const ground = standHeight + 10 + keeper.height
    const spotY = ground + keeper.spotDepth
    return { width: keeper.width + left * 2, height: spotY + 18, left, ground, goalWidth: keeper.width, goalHeight: keeper.height, spot: { x: left + keeper.width / 2, y: spotY }, standHeight }
  }, [keeper])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('wait')
  const [outcome, setOutcome] = useState<KeeperOutcome | null>(null)
  const [saves, setSaves] = useState(0)
  const [crowd, setCrowd] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startedAt = useRef(performance.now())
  const taps = useRef<Array<KeeperTap | null>>([])
  const indexRef = useRef(0)
  /** This shot's tap (or none), what it came to, and when it was settled on the page's clock. */
  const settled = useRef<{ tap: KeeperTap | null, outcome: KeeperOutcome, at: number } | null>(null)
  const finished = useRef(false)

  useEffect(() => {
    let live = true
    void loadImage(art('pitch/crowd_strip_tile.png')).then(image => live && setCrowd(image))
    return () => {
      live = false
    }
  }, [])

  const settle = (tap: KeeperTap | null) => {
    if (settled.current || finished.current)
      return
    const shot = shots[indexRef.current]
    const result = keeperOutcome(shot, tap, config)
    taps.current.push(tap)
    settled.current = { tap, outcome: result, at: performance.now() }
    setOutcome(result)
    setPhase('done')
    play(result === 'saved' ? 'perfect' : 'error', 0.8)
    if (result === 'saved')
      setSaves(current => current + 1)
  }

  /** A tap at a point in goal units, now. Rounded to a hundredth of a unit: short to send, and the game uses it too. */
  const tapAt = (x: number, y: number) => settle({ ms: Math.round(performance.now() - startedAt.current), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })

  const onPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerOnCanvas(event, scene)
    if (!point)
      return
    const goal = toGoal(scene, point.x, point.y)
    tapAt(goal.x, goal.y)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space')
        return
      event.preventDefault()
      const ball = keeperBallAt(shots[indexRef.current], performance.now() - startedAt.current, config)
      tapAt(ball.x, ball.y)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useCanvasLoop(canvasRef, {
    update: () => {
      if (finished.current)
        return
      const now = performance.now()
      const shot = shots[indexRef.current]
      const ms = now - startedAt.current
      const lineMs = shot.delayMs + shot.windowMs
      if (!settled.current) {
        if (ms >= shot.delayMs && phase === 'wait')
          setPhase('shot')
        if (ms > lineMs)
          settle(null)
        return
      }
      // The next shot once this one is in (or saved) and the outcome has shown.
      if (now >= Math.max(settled.current.at, startedAt.current + lineMs) + FEEDBACK_MS) {
        // Endless (the daily challenge): the first goal ends it.
        const ended = config.minigames.endless && settled.current.outcome !== 'saved'
        if (!ended && indexRef.current + 1 < shots.length) {
          indexRef.current += 1
          startedAt.current = now
          settled.current = null
          setIndex(indexRef.current)
          setOutcome(null)
          setPhase('wait')
        }
        else {
          finished.current = true
          onFinish(taps.current)
        }
      }
    },
    render: (context) => {
      const now = performance.now()
      const shot = shots[indexRef.current]
      const ms = now - startedAt.current
      const lineMs = shot.delayMs + shot.windowMs
      const done = settled.current
      const keeperX = scene.left + keeper.width / 2
      const line = toCanvas(scene, shot.x, shot.y)
      drawGoalScene(context, scene, crowd)

      let pose: KeeperPose
      if (!done) {
        pose = ms < shot.delayMs ? { pose: 'idle', frame: Math.floor(ms / 380) } : { pose: 'ready' }
      }
      else {
        const since = now - done.at
        const fall = (from: number) => 1 + clamp((now - from - FALL_AFTER_MS) / FALL_MS, 0, 1)
        if (done.outcome === 'saved') {
          // Across to where the ball is going, getting there with it.
          const arrive = startedAt.current + lineMs
          const length = Math.max(160, arrive - done.at)
          pose = { pose: 'dive', to: line, amount: now < arrive ? clamp(since / length, 0, 1) : fall(arrive) }
        }
        else if (done.tap) {
          // Where you tapped (inside the goal), wherever the ball is.
          const spot = toCanvas(scene, clamp(done.tap.x, 0, keeper.width), clamp(done.tap.y, 0, keeper.height))
          pose = { pose: 'dive', to: spot, amount: since < DIVE_MS + FALL_AFTER_MS ? clamp(since / DIVE_MS, 0, 1) : fall(done.at + DIVE_MS) }
        }
        else {
          // Beaten without moving: a late lunge.
          pose = { pose: 'dive', to: line, amount: clamp(since / DIVE_MS, 0, 0.35) }
        }
      }
      drawKeeper(context, keeperX, scene.ground, pose)
      drawGoalFrame(context, scene)

      // The ball: on the spot, then flying at the goal (the rules say where); saved, it is palmed away.
      const inFlight = Math.min(ms, lineMs)
      const ball = keeperBallAt(shot, inFlight, config)
      const at = toCanvas(scene, ball.x, ball.y)
      if (ms < shot.delayMs) {
        context.fillStyle = 'rgba(7, 11, 30, 0.45)'
        context.fillRect(scene.spot.x - 5, scene.spot.y, 11, 2)
      }
      if (ms <= lineMs) {
        // Sitting on the spot, then lifting off it as it flies.
        drawBall(context, at.x, at.y - ball.radius * (1 - ball.progress), ball.radius, ms < shot.delayMs ? 0 : ms / 45)
      }
      else if (done?.outcome === 'saved') {
        const t = (ms - lineMs) / 1000
        const away = shot.x < keeper.width / 2 ? -1 : 1
        drawBall(context, at.x + away * 55 * t, at.y - 60 * t + 110 * t * t, ball.radius, ms / 45, clamp(1 - t / 0.6, 0, 1))
      }
      else {
        drawNetRipple(context, at.x, at.y, (ms - lineMs) / 450)
        drawBall(context, at.x, Math.min(scene.ground - ball.radius, at.y + Math.min(5, (ms - lineMs) * 0.02)), ball.radius, 2)
      }

      // Where the tap landed, for a moment: green on the ball, red off it.
      if (done?.tap && now - done.at < 450) {
        const mark = toCanvas(scene, done.tap.x, done.tap.y)
        context.fillStyle = done.outcome === 'saved' ? '#7bdc4a' : '#ff4d6d'
        context.fillRect(Math.round(mark.x) - 2, Math.round(mark.y), 5, 1)
        context.fillRect(Math.round(mark.x), Math.round(mark.y) - 2, 1, 5)
      }
    },
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-baseline justify-between">
        <span>{config.minigames.endless ? `Shot ${index + 1} · until one goes in` : `Shot ${index + 1} of ${shots.length}`}</span>
        <span className="font-display text-xs text-primary tabular-nums">{`${saves} saved`}</span>
      </div>
      <div className="relative w-full max-w-sm">
        <canvas
          ref={canvasRef}
          width={scene.width}
          height={scene.height}
          className="pixel block w-full touch-none border-2 border-slate"
          aria-label="Keeper Reflex: you are in goal. Tap the ball"
          onPointerDown={onPointer}
        />
        {outcome
          ? (
              <div
                key={index}
                className={`pointer-events-none absolute inset-x-0 text-center font-display text-4xl ${outcome === 'saved' ? 'text-success' : 'text-error'}`}
                style={{ top: `${((scene.ground - keeper.height - KEEPER_HEIGHT / 2) / scene.height) * 100}%`, textShadow: '0 3px 0 #0b1028, 3px 0 0 #0b1028, -3px 0 0 #0b1028, 0 -3px 0 #0b1028', animation: 'pp-pop 180ms steps(3)' }}
                aria-live="polite"
              >
                {VERDICT[outcome]}
              </div>
            )
          : null}
      </div>
      <div className="h-7 font-display text-sm" aria-live="polite">
        {phase === 'wait' ? <span className="text-muted">Wait for it…</span> : phase === 'shot' ? <span className="text-primary">Tap the ball!</span> : null}
      </div>
      <span className="text-muted">Tap the ball before it crosses the line. Tap before it is struck and you have dived too early.</span>
    </div>
  )
}

import type { PenaltyOutcome, PenaltyShot } from '@ld/pixel-pitch-core'
import type { GoalScene } from '../lib/goal-scene'
import type { KeeperPose } from '../lib/goalkeeper-sprite'
import { loadImage, useCanvasLoop } from '@ld/game'
import { keeperAt, penaltyBallAt, penaltyRounds, penaltyShot } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { art } from '../lib/art'
import { drawGoalFrame, drawGoalScene, drawNetRipple, toCanvas } from '../lib/goal-scene'
import { drawKeeper, KEEPER_HEIGHT } from '../lib/goalkeeper-sprite'
import { drawBall } from '../lib/pixel-sprite'
import { usePlayConfig } from '../queries/use-play-config'

/** A tap sooner than this after the round starts is ignored: nobody can mean it, and the server refuses it. */
const MIN_TAP_MS = 150
/** How long the outcome shows before the next penalty. */
const FEEDBACK_MS = 1500
/** The ball's flight from the spot. */
const FLIGHT_MS = 380
/** The keeper's dive: from the tap, how long until they are at full stretch, and when they start to come down. */
const DIVE_FROM_MS = 40
const DIVE_MS = 320
const FALL_FROM_MS = 520
const FALL_MS = 260

const VERDICT: Record<PenaltyOutcome, string> = { wide: 'Wide!', over: 'Over the bar!', saved: 'Saved!', goal: 'Goal!', corner: 'Corner! 2 points' }
const SCORED: Record<PenaltyOutcome, boolean> = { wide: false, over: false, saved: false, goal: true, corner: true }
const DOT: Record<PenaltyOutcome, string> = { wide: 'bg-error', over: 'bg-error', saved: 'bg-error', goal: 'bg-success', corner: 'bg-primary' }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Penalty Shootout: five penalties. A ball wanders about the goal, over the bar and wide of the posts, and the keeper
 * shuffles along the line; tap (or SHOOT!, or Space) and the shot goes where the ball is. Wide, over or within the
 * keeper's reach scores nothing, a goal 1, the shaded corners 2. Scored by the server from the milliseconds each tap
 * came after its round began, with the game's seed: the ball and the keeper drawn here are the rules' own.
 */
export function PenaltyGame({ seed, onFinish }: { seed: string, onFinish: (taps: number[]) => void }) {
  const config = usePlayConfig()
  const { pens } = config.minigames
  const rounds = useMemo(() => penaltyRounds(seed, config), [seed, config])
  const scene = useMemo<GoalScene>(() => {
    const standHeight = 16
    const left = pens.wide + 4
    const ground = standHeight + pens.over + pens.goalHeight + 6
    const width = pens.goalWidth + left * 2
    return { width, height: ground + 54, left, ground, goalWidth: pens.goalWidth, goalHeight: pens.goalHeight, spot: { x: width / 2, y: ground + 40 }, standHeight }
  }, [pens])
  const [round, setRound] = useState(0)
  const [outcomes, setOutcomes] = useState<PenaltyOutcome[]>([])
  const [crowd, setCrowd] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startedAt = useRef(performance.now())
  const taps = useRef<number[]>([])
  /** The shot taken this round: what it came to, and when (on the page's clock) it was taken. */
  const taken = useRef<{ result: PenaltyShot, ms: number, at: number } | null>(null)
  const roundRef = useRef(0)
  const shot = outcomes.length > round ? outcomes[round] : null
  const total = outcomes.reduce((sum, outcome) => sum + (outcome === 'corner' ? 2 : outcome === 'goal' ? 1 : 0), 0)

  useEffect(() => {
    let live = true
    void loadImage(art('pitch/crowd_strip_tile.png')).then(image => live && setCrowd(image))
    return () => {
      live = false
    }
  }, [])

  const shoot = () => {
    if (taken.current)
      return
    const now = performance.now()
    const ms = Math.round(now - startedAt.current)
    if (ms < MIN_TAP_MS)
      return
    const result = penaltyShot(rounds[round], ms, config)
    taps.current.push(ms)
    taken.current = { result, ms, at: now }
    setOutcomes(current => [...current, result.outcome])
    setTimeout(() => {
      if (round + 1 < rounds.length) {
        startedAt.current = performance.now()
        taken.current = null
        roundRef.current = round + 1
        setRound(round + 1)
      }
      else {
        onFinish(taps.current)
      }
    }, FEEDBACK_MS)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        shoot()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useCanvasLoop(canvasRef, {
    update: () => {},
    render: (context) => {
      const now = performance.now()
      const current = rounds[roundRef.current]
      const shotNow = taken.current
      const ms = shotNow ? shotNow.ms : now - startedAt.current
      const { ground, spot } = scene
      drawGoalScene(context, scene, crowd)

      // The corners, worth 2.
      context.fillStyle = 'rgba(255, 210, 63, 0.2)'
      for (const x of [0, pens.goalWidth - pens.cornerWidth]) {
        for (const y of [pens.goalHeight, pens.cornerHeight]) {
          const corner = toCanvas(scene, x, y)
          context.fillRect(Math.round(corner.x), Math.round(corner.y), pens.cornerWidth, pens.cornerHeight)
        }
      }

      // The keeper: shuffling (or set) until the shot, then diving at it, as far as they can reach.
      const keeperX = scene.left + keeperAt(current, ms)
      let pose: KeeperPose
      if (!shotNow) {
        const moving = keeperAt(current, ms) - keeperAt(current, ms - 60)
        pose = Math.abs(moving) > 0.6
          ? { pose: 'step', toward: moving < 0 ? 'left' : 'right', frame: Math.floor(ms / 110) }
          : { pose: 'idle', frame: Math.floor(ms / 380) }
      }
      else {
        const since = now - shotNow.at
        const ball = toCanvas(scene, shotNow.result.x, shotNow.result.y)
        // Inside the reach (an ellipse about the keeper) the gloves get there; outside it they fall short, on its edge.
        const dx = shotNow.result.x - shotNow.result.keeper
        const dy = shotNow.result.y - pens.reachMid
        const stretch = Math.sqrt((dx / pens.reachX) ** 2 + (dy / pens.reachY) ** 2)
        const short = stretch > 1 ? 0.97 / stretch : 1
        const to = { x: keeperX + dx * short, y: ground - pens.reachMid - dy * short }
        const amount = since < FALL_FROM_MS ? clamp01((since - DIVE_FROM_MS) / DIVE_MS) : 1 + clamp01((since - FALL_FROM_MS) / FALL_MS)
        pose = shotNow.result.outcome === 'saved' ? { pose: 'dive', to: ball, amount } : { pose: 'dive', to, amount }
      }
      drawKeeper(context, keeperX, ground, pose)
      drawGoalFrame(context, scene)

      const onSpot = { x: spot.x, y: spot.y - 5 }
      if (!shotNow) {
        // The ball sits on the spot; the one wandering about the goal is where it will go.
        context.fillStyle = 'rgba(7, 11, 30, 0.45)'
        context.fillRect(spot.x - 4, spot.y, 9, 2)
        drawBall(context, onSpot.x, onSpot.y, 5)
        const ball = penaltyBallAt(current, ms, config)
        const aim = toCanvas(scene, ball.x, ball.y)
        drawAim(context, aim.x, aim.y, pens.ballRadius + 3, Math.floor(ms / 250) % 2 === 0)
        drawBall(context, aim.x, aim.y, pens.ballRadius, ms / 90)
        return
      }

      const since = now - shotNow.at
      const target = toCanvas(scene, shotNow.result.x, shotNow.result.y)
      const flight = clamp01(since / FLIGHT_MS)
      if (flight < 1) {
        drawAim(context, target.x, target.y, pens.ballRadius + 3, true)
        const eased = 1 - (1 - flight) * (1 - flight)
        const x = onSpot.x + (target.x - onSpot.x) * eased
        const y = onSpot.y + (target.y - onSpot.y) * eased - 10 * 4 * flight * (1 - flight)
        drawBall(context, x, y, 6 + (pens.ballRadius - 6) * eased, since / 40)
        return
      }
      const after = since - FLIGHT_MS
      const outcome = shotNow.result.outcome
      if (SCORED[outcome]) {
        // In the net: it drops a little and the mesh ripples.
        drawNetRipple(context, target.x, target.y, after / 450)
        drawBall(context, target.x, Math.min(ground - pens.ballRadius, target.y + Math.min(6, after * 0.02)), pens.ballRadius, 2)
      }
      else if (outcome === 'saved') {
        // Palmed away, out and up, then falling.
        const away = target.x < keeperX ? -1 : 1
        const t = after / 1000
        drawBall(context, target.x + away * 60 * t, target.y - 70 * t + 120 * t * t, pens.ballRadius, since / 50, clamp01(1 - after / 700))
      }
      else {
        // Past the post or over the bar, into the crowd.
        const outX = outcome === 'wide' ? (target.x < scene.width / 2 ? -1 : 1) : (target.x - onSpot.x) / 80
        const t = after / 1000
        drawBall(context, target.x + outX * 50 * t, target.y - 60 * t, pens.ballRadius - 1, since / 50, clamp01(1 - after / 450))
      }
    },
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <span>{`Penalty ${round + 1} of ${rounds.length}${round === rounds.length - 1 ? ' · last' : ''}`}</span>
        <span className="flex items-center gap-1" aria-hidden>
          {rounds.map((_, index) => ({ id: `penalty-${index + 1}`, outcome: outcomes.at(index) })).map(({ id, outcome }) => <span key={id} className={`size-3 border-2 border-slate ${outcome ? DOT[outcome] : 'bg-base-100'}`} />)}
        </span>
        <span className="font-display text-xs text-primary tabular-nums">{`${total} pts`}</span>
      </div>

      <div className="relative w-full max-w-sm">
        <canvas
          ref={canvasRef}
          width={scene.width}
          height={scene.height}
          className="pixel block w-full touch-none border-2 border-slate"
          role="img"
          aria-label="The goal, with the keeper and the ball you are aiming with"
          onPointerDown={shoot}
        />
        {shot
          ? (
              <div
                key={round}
                className={`pointer-events-none absolute inset-x-0 text-center font-display text-4xl ${SCORED[shot] ? 'text-primary' : 'text-error'}`}
                style={{ top: `${((scene.ground - pens.goalHeight - KEEPER_HEIGHT) / scene.height) * 100}%`, textShadow: '0 3px 0 #0b1028, 3px 0 0 #0b1028, -3px 0 0 #0b1028, 0 -3px 0 #0b1028', animation: 'pp-pop 180ms steps(3)' }}
                aria-live="polite"
              >
                {VERDICT[shot]}
              </div>
            )
          : null}
      </div>

      <button type="button" className="btn btn-primary h-16 w-full max-w-sm font-display text-lg" onPointerDown={shoot} disabled={shot !== null}>SHOOT!</button>
      <span className="text-muted">Tap when the ball is in a yellow corner, away from the keeper: 2 points. In the goal, 1. Over the bar, wide or at the keeper, none.</span>
    </div>
  )
}

/** Yellow corner brackets round the ball you are aiming with; `on` blinks them. */
function drawAim(context: CanvasRenderingContext2D, x: number, y: number, size: number, on: boolean) {
  context.fillStyle = on ? '#ffd23f' : 'rgba(255, 210, 63, 0.55)'
  const left = Math.round(x - size)
  const top = Math.round(y - size)
  const span = size * 2
  for (const [cx, cy, sx, sy] of [[left, top, 1, 1], [left + span, top, -1, 1], [left, top + span, 1, -1], [left + span, top + span, -1, -1]]) {
    context.fillRect(sx > 0 ? cx : cx - 2, cy, 3, 1)
    context.fillRect(cx, sy > 0 ? cy : cy - 2, 1, 3)
  }
}

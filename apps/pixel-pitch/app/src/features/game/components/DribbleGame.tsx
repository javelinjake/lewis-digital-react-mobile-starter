import type { Defender, LaneMove, SpriteParts } from '@ld/pixel-pitch-core'
import type { RunnerFrames } from '../lib/runner-frames'
import { useCanvasLoop } from '@ld/game'
import { defenderProgress, defendersBeaten, dribbleEndMs, dribbleRun, dribbleTackle, HAIR_COLOURS, HAIR_STYLES, SKIN_TONES, startLane } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { kitOf, rivalKit } from '../lib/club'
import { FRAME_HEIGHT, FRAME_WIDTH, runnerFrames } from '../lib/runner-frames'
import { useCatalogue, useClub } from '../queries/use-game'
import { usePlayConfig } from '../queries/use-play-config'

/** The pitch, in art pixels; drawn three times the size. */
const WIDTH = 112
const HEIGHT = 104
const SCALE = 3
/** Where the player's feet are. A defender's feet reach `PLAYER_Y - CONTACT` as its tackle window opens. */
const PLAYER_Y = 94
const CONTACT = 8
/** How long a lane change takes on screen, and how fast the grass goes by. */
const STEP_MS = 120
const GRASS_PX_PER_MS = 0.04
const STRIPE = 13
/** Kinds of defender to draw, told apart by skin and hair. */
const DEFENDER_LOOKS = 4

const FALLBACK: SpriteParts = { skin: 1, hairStyle: HAIR_STYLES.indexOf('short'), hairColour: HAIR_COLOURS.indexOf('brown') }

const BALL = [
  ['.kkk.', 'kwwkk', 'kwkwk', 'kkwwk', '.kkk.'],
  ['.kkk.', 'kkwwk', 'kwkwk', 'kwwkk', '.kkk.'],
]
const BALL_COLOURS: Record<string, string> = { k: '#10122a', w: '#f4f4f4' }

const laneX = (lane: number, lanes: number) => Math.round(((lane + 0.5) / lanes) * WIDTH)
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function drawBall(context: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  for (const [row, line] of BALL[frame % BALL.length].entries()) {
    for (const [column, key] of [...line].entries()) {
      if (key === '.')
        continue
      context.fillStyle = BALL_COLOURS[key]
      context.fillRect(x + column, y + row, 1, 1)
    }
  }
}

/** A frame with its feet at (`x`, `feet`). Before the art has loaded, a block in the kit colour stands in. */
function drawRunner(context: CanvasRenderingContext2D, frame: HTMLCanvasElement | undefined, x: number, feet: number, colour: string) {
  if (frame) {
    context.drawImage(frame, Math.round(x - FRAME_WIDTH / 2), Math.round(feet - FRAME_HEIGHT))
    return
  }
  context.fillStyle = colour
  context.fillRect(Math.round(x - 5), Math.round(feet - 14), 10, 14)
}

/** The player's own runner: one of the club's outfield players, in the club's kit. */
function usePlayerSprite(): { sprite: SpriteParts, kit: readonly [string, string] } {
  const club = useClub().data
  const { lookup } = useCatalogue()
  return useMemo(() => {
    const kit = club ? kitOf(club) : (['#3f7fd6', '#f4f4f4'] as const)
    const cards = club?.cards ?? []
    const fielded = (club?.club.state.lineup ?? [])
      .map(id => cards.find(card => card.id === id))
      .map(card => (card ? lookup(card.playerId) : undefined))
      .filter(player => player !== undefined)
    const runner = fielded.find(player => player.position !== 'GK') ?? fielded[0]
    return { sprite: runner?.sprite ?? FALLBACK, kit }
  }, [club, lookup])
}

/**
 * Dribble Dash: defenders come down the lanes; switch lane to go round them. One tackle ends the run. The lane changes
 * are sent with when they came, and the server works out the tackle from them, the same sum the game uses here.
 *
 * The player is one of the club's own, in the club's kit, seen from behind with the ball at their feet; the defenders
 * run at them in the other side's kit and lunge as they close in. Drawn on a small canvas every frame.
 */
export function DribbleGame({ seed, onFinish }: { seed: string, onFinish: (moves: LaneMove[]) => void }) {
  const config = usePlayConfig()
  /** The parent's handler, called from the timers without restarting them when it changes. */
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })
  const { lanes, tackleFrom, tackleTo } = config.minigames.dribble
  const defenders = useMemo(() => dribbleRun(seed, config), [seed, config])
  const end = useMemo(() => dribbleEndMs(defenders), [defenders])
  const { sprite, kit } = usePlayerSprite()
  const rival = rivalKit(kit)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lane, setLane] = useState(() => startLane(config))
  const [tackled, setTackled] = useState(false)
  const [beaten, setBeaten] = useState(0)
  const beatenRef = useRef(0)
  const moves = useRef<LaneMove[]>([])
  const laneRef = useRef(startLane(config))
  /** The last lane change, for the step across: from which lane, and when (ms into the run). */
  const stepRef = useRef<{ from: number, at: number } | null>(null)
  const startedAt = useRef(performance.now())
  const finished = useRef<{ atMs: number, tackled: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [art, setArt] = useState<{ player: RunnerFrames, defenders: RunnerFrames[] } | null>(null)

  const playerKey = JSON.stringify([sprite, kit])
  useEffect(() => {
    let live = true
    const looks = Array.from({ length: DEFENDER_LOOKS }, (_, look): SpriteParts => ({
      skin: (look * 2 + seed.length) % SKIN_TONES,
      hairStyle: 1 + ((look * 3) % (HAIR_STYLES.length - 1)),
      hairColour: (look * 5 + 1) % HAIR_COLOURS.length,
    }))
    void Promise.all([runnerFrames(sprite, kit, true), ...looks.map(look => runnerFrames(look, rival))]).then(([player, ...others]) => {
      if (live)
        setArt({ player, defenders: others })
    })
    return () => {
      live = false
    }
    // `playerKey` stands for the sprite and kit, which are rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, seed])

  useEffect(() => {
    startedAt.current = performance.now()
    return () => clearTimeout(timer.current)
  }, [])

  /** Where a defender's feet are `ms` into the run, and whether it is close enough to lunge. */
  const defenderAt = (defender: Defender, ms: number) => {
    const progress = defenderProgress(defender, ms)
    return { progress, feet: (progress / tackleFrom) * (PLAYER_Y - CONTACT), lunging: progress >= tackleFrom - 0.12 && progress <= tackleTo + 0.06 }
  }

  useCanvasLoop(canvasRef, {
    update: () => {},
    render: (context) => {
      const now = performance.now() - startedAt.current
      if (!finished.current) {
        const hit = dribbleTackle(defenders, moves.current, config, now)
        if (hit || now > end) {
          finished.current = { atMs: hit ? hit.atMs : now, tackled: Boolean(hit) }
          setTackled(Boolean(hit))
          timer.current = setTimeout(() => finishRef.current(moves.current), 800)
        }
      }
      // A tackle stops the picture at the moment it happened.
      const ms = finished.current?.tackled ? finished.current.atMs : now
      const count = defendersBeaten(defenders, ms, config)
      if (count !== beatenRef.current) {
        beatenRef.current = count
        setBeaten(count)
      }

      // The grass, going by as the player runs up it, and the lane lines.
      const scroll = (ms * GRASS_PX_PER_MS) % (STRIPE * 2)
      context.fillStyle = '#23702d'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      context.fillStyle = '#287a32'
      for (let y = -STRIPE * 2 + scroll; y < HEIGHT; y += STRIPE * 2)
        context.fillRect(0, Math.round(y), WIDTH, STRIPE)
      context.fillStyle = 'rgba(244, 244, 244, 0.28)'
      for (let line = 1; line < lanes; line++) {
        const x = Math.round((line / lanes) * WIDTH)
        for (let y = -8 + (scroll % 8); y < HEIGHT; y += 8)
          context.fillRect(x, Math.round(y), 1, 4)
      }

      // The player: across to the new lane with a little hop, the ball rolling at their feet.
      const step = stepRef.current
      const stepT = step ? Math.min(1, (ms - step.at) / STEP_MS) : 1
      const toX = laneX(laneRef.current, lanes)
      const x = step && stepT < 1 ? laneX(step.from, lanes) + (toX - laneX(step.from, lanes)) * ease(stepT) : toX
      const hop = step && stepT < 1 ? Math.round(Math.sin(stepT * Math.PI) * 2) : 0
      const runFrame = Math.floor(ms / 110) % 4

      // Defenders further up the pitch are drawn first, so nearer ones stand in front.
      const onPitch = defenders
        .map((defender, index) => ({ defender, index, ...defenderAt(defender, ms) }))
        .filter(entry => entry.progress >= 0 && entry.feet <= HEIGHT + FRAME_HEIGHT)
      const behind = onPitch.filter(entry => entry.feet <= PLAYER_Y)
      const front = onPitch.filter(entry => entry.feet > PLAYER_Y)
      const drawDefender = (entry: typeof onPitch[number]) => {
        const looks = art?.defenders[entry.index % DEFENDER_LOOKS]
        const dx = laneX(entry.defender.lane, lanes)
        // A lunge goes for the ball: towards the player's side, or the way it was running in the same lane.
        const side = x < dx - 2 ? 0 : x > dx + 2 ? 1 : entry.index % 2
        const frame = entry.lunging ? looks?.lunge[side] : looks?.run[Math.floor((ms + entry.defender.atMs) / 100) % 4]
        context.fillStyle = 'rgba(11, 16, 40, 0.35)'
        context.fillRect(dx - 5, Math.round(entry.feet) - 1, 10, 2)
        drawRunner(context, frame, dx, entry.feet, rival[0])
      }
      behind.forEach(drawDefender)
      context.fillStyle = 'rgba(11, 16, 40, 0.35)'
      context.fillRect(Math.round(x) - 5, PLAYER_Y - 1, 10, 2)
      drawRunner(context, art?.player.run[runFrame], x, PLAYER_Y - hop, kit[0])
      // The ball runs ahead of the right foot, nudged on every other step; a tackle knocks it loose.
      const loose = finished.current?.tackled ? 4 : 0
      drawBall(context, Math.round(x) + 2 + loose, PLAYER_Y - 6 - (runFrame % 2) - loose - hop, Math.floor(ms / 90) + (finished.current?.tackled ? 1 : 0))
      front.forEach(drawDefender)
    },
  })

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
    stepRef.current = { from: laneRef.current, at: ms }
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <span>{tackled ? 'Tackled!' : 'Keep going'}</span>
        <span className="font-display text-xs text-primary tabular-nums" aria-live="polite">{`${beaten} of ${defenders.length} beaten`}</span>
      </div>
      <div className="relative max-w-full border-2 border-slate" style={{ width: WIDTH * SCALE + 4 }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="pixel block w-full" role="img" aria-label="The pitch" />
        {/* Where the player is, for screen readers and tests: over the runner, moving lane with them. */}
        <div
          className="absolute size-6 -translate-x-1/2"
          style={{ left: `${((lane + 0.5) / lanes) * 100}%`, top: `${((PLAYER_Y - 16) / HEIGHT) * 100}%` }}
          role="img"
          aria-label={`You, in lane ${lane + 1}`}
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary h-20 font-display text-lg" aria-label="Move left" onPointerDown={() => move(-1)}>◀</button>
        <button type="button" className="btn btn-primary h-20 font-display text-lg" aria-label="Move right" onPointerDown={() => move(1)}>▶</button>
      </div>
    </div>
  )
}

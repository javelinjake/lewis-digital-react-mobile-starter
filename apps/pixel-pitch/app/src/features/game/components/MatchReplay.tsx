import type { FixtureResult } from '@ld/pixel-pitch-core'
import { loadImage, useCanvasLoop } from '@ld/game'
import { useReducedEffects } from '@ld/react-utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { art } from '../lib/art'

const WIDTH = 176
const HEIGHT = 76
const DURATION_MS = 24_000
const MS_PER_MINUTE = DURATION_MS / 90
/** The ball takes this long to reach the goal for a chance. */
const RUN_MS = 900

interface Images {
  pitch: HTMLImageElement
  ball: HTMLImageElement[]
  goal: HTMLImageElement
}

function useImages() {
  const [images, setImages] = useState<Images | null>(null)
  useEffect(() => {
    let live = true
    void Promise.all([
      loadImage(art('pitch/pitch_match_176x76.png')),
      Promise.all([0, 1, 2, 3].map(frame => loadImage(art(`pitch/ball_${frame}.png`)))),
      loadImage(art('text/banner_goal.png')),
    ]).then(([pitch, ball, goal]) => {
      if (live)
        setImages({ pitch, ball, goal })
    })
    return () => {
      live = false
    }
  }, [])
  return images
}

/** Where the ball is at a time: drifting around midfield, running at a goal before each chance, and back again. */
function ballAt(events: FixtureResult['events'], ms: number) {
  const centre = { x: WIDTH / 2 + Math.sin(ms / 700) * 18, y: HEIGHT / 2 + Math.cos(ms / 900) * 10 }
  for (const event of events) {
    const at = event.minute * MS_PER_MINUTE
    if (ms < at - RUN_MS || ms > at + RUN_MS)
      continue
    // Our side attacks to the right.
    const goalX = event.side === 'for' ? WIDTH - 10 : 10
    const target = { x: goalX, y: HEIGHT / 2 + (event.kind === 'miss' ? (event.slot % 2 ? -14 : 14) : (event.slot - 2) * 2) }
    const t = ms < at ? 1 - (at - ms) / RUN_MS : 1 - (ms - at) / RUN_MS
    const eased = t * t * (3 - 2 * t)
    return { x: centre.x + (target.x - centre.x) * eased, y: centre.y + (target.y - centre.y) * eased }
  }
  return centre
}

/** A 24-second pixel replay of a match from its events. Skippable; low-effects mode shows the goal ticker only. */
export function MatchReplay({ fixture, clubName, onDone }: { fixture: FixtureResult, clubName: string, onDone: () => void }) {
  const reduced = useReducedEffects()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useImages()
  const elapsed = useRef(0)
  const [finished, setFinished] = useState(reduced)
  const [clock, setClock] = useState(reduced ? 90 : 0)
  const goals = useMemo(() => fixture.events.filter(event => event.kind === 'goal'), [fixture.events])

  const scoreAt = (minute: number) => ({
    ours: goals.filter(goal => goal.side === 'for' && goal.minute <= minute).length,
    theirs: goals.filter(goal => goal.side === 'against' && goal.minute <= minute).length,
  })
  const score = finished ? { ours: fixture.goalsFor, theirs: fixture.goalsAgainst } : scoreAt(clock)

  useCanvasLoop(canvasRef, {
    paused: finished || !images,
    maxFps: 30,
    update: (step) => {
      elapsed.current += step
      if (elapsed.current >= DURATION_MS)
        setFinished(true)
      const minute = Math.min(90, Math.floor(elapsed.current / MS_PER_MINUTE))
      setClock(current => (current === minute ? current : minute))
    },
    render: (context) => {
      if (!images)
        return
      const ms = elapsed.current
      context.drawImage(images.pitch, 0, 0)
      const ball = ballAt(fixture.events, ms)
      context.drawImage(images.ball[Math.floor(ms / 60) % 4], Math.round(ball.x - 3), Math.round(ball.y - 3))
      const recent = goals.find(goal => ms >= goal.minute * MS_PER_MINUTE + RUN_MS * 0.2 && ms < goal.minute * MS_PER_MINUTE + 1400)
      if (recent)
        context.drawImage(images.goal, Math.round((WIDTH - images.goal.width) / 2), 4)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between font-display text-xs" aria-live="polite">
        <span className="max-w-[40%] truncate">{clubName}</span>
        <span className="text-lg text-primary tabular-nums">{`${score.ours} – ${score.theirs}`}</span>
        <span className="max-w-[40%] truncate text-right">{fixture.rival.name}</span>
      </div>
      <span className="text-center text-muted tabular-nums">{finished ? 'Full time' : `${clock}'`}</span>

      {reduced
        ? null
        : <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="pixel w-full border-2 border-slate" aria-label="Match replay" />}

      <ul className="flex flex-col gap-1 text-lg" aria-label="Goals">
        {goals.filter(goal => finished || goal.minute <= clock).map(goal => (
          <li key={`${goal.side}-${goal.minute}-${goal.slot}`} className={goal.side === 'for' ? 'text-success' : 'text-error'}>
            {`${goal.minute}' Goal for ${goal.side === 'for' ? clubName : fixture.rival.name}`}
          </li>
        ))}
      </ul>

      {finished
        ? (
            <div className="flex flex-col items-center gap-2 border-2 border-primary bg-base-100 p-4">
              <img src={art(`text/banner_${fixture.result}.png`)} alt={fixture.result} className="pixel h-auto w-40" />
              <span className="text-xl">{`+${fixture.coins} coins${fixture.points ? ` · +${fixture.points} pts` : ''}`}</span>
              {fixture.promotedTo ? <img src={art('text/banner_promoted.png')} alt="Promoted" className="pixel h-auto w-48" /> : null}
              <button type="button" className="btn btn-primary min-h-11 w-full font-display text-xs" onClick={onDone}>Continue</button>
            </div>
          )
        : <button type="button" className="btn btn-ghost min-h-11" onClick={() => setFinished(true)}>Skip</button>}
    </div>
  )
}

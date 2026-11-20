import type { CommentaryLine, FixtureResult } from '@ld/pixel-pitch-core'
import { commentate } from '@ld/pixel-pitch-core'
import { useReducedEffects } from '@ld/react-utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { reportable } from '../lib/fixture'
import { lineTimes } from '../lib/line-times'
import { useGameConfig } from '../queries/use-game'
import { ResultPanel } from './ResultPanel'

const TONE: Record<CommentaryLine['kind'], string> = {
  kickoff: 'text-primary',
  halftime: 'text-primary',
  fulltime: 'text-primary',
  goal: '',
  save: '',
  miss: '',
  build: 'text-muted',
}

function lineClass(line: CommentaryLine) {
  if (line.kind === 'goal')
    return line.side === 'for' ? 'text-success' : 'text-error'
  return TONE[line.kind]
}

/** The match as a written report, line by line, newest on top. Skippable. Low-effects mode shows it all at once. */
export function MatchTextReplay({ fixture, clubName, onDone }: { fixture: FixtureResult, clubName: string, onDone: () => void }) {
  const config = useGameConfig()
  const reduced = useReducedEffects()
  const lines = useMemo(
    () => commentate({ clubName, fixture: reportable(fixture), config, seed: `${fixture.no}:${fixture.kickoffAt}` }),
    [clubName, fixture, config],
  )
  const times = useMemo(() => lineTimes(lines, config.match.minutes), [lines, config.match.minutes])
  const [shown, setShown] = useState(reduced ? lines.length : 0)
  const started = useRef(0)

  useEffect(() => {
    if (shown >= lines.length)
      return
    started.current ||= performance.now()
    const wait = Math.max(0, times[shown] - (performance.now() - started.current))
    const timer = setTimeout(() => setShown(count => Math.min(lines.length, count + 1)), wait)
    return () => clearTimeout(timer)
  }, [shown, lines.length, times])

  const finished = shown >= lines.length
  const latest = lines[Math.max(0, shown - 1)]
  const score = shown === 0 ? [0, 0] : latest.score
  const visible = lines.slice(0, shown).reverse()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 font-display text-xs" aria-live="polite">
        <span className="min-w-0 flex-1 truncate">{clubName}</span>
        <span className="shrink-0 whitespace-nowrap text-lg text-primary tabular-nums">{`${score[0]}–${score[1]}`}</span>
        <span className="min-w-0 flex-1 truncate text-right">{fixture.rival.name}</span>
      </div>
      <span className="text-center text-muted tabular-nums">{finished ? 'Full time' : `${latest?.minute ?? 0}'`}</span>

      {finished ? null : <button type="button" className="btn btn-ghost min-h-11" onClick={() => setShown(lines.length)}>Skip</button>}

      <ol className="flex flex-col gap-2 text-lg" aria-label="Match report">
        {visible.map(line => (
          <li key={`${line.minute}-${line.kind}-${line.text}`} className={`flex gap-2 leading-tight ${lineClass(line)} ${line.kind === 'goal' ? 'border-l-4 border-current pl-2' : ''}`}>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted">{line.kind === 'kickoff' ? 'KO' : `${line.minute}'`}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ol>

      {finished ? <ResultPanel fixture={fixture} onDone={onDone} /> : null}
    </div>
  )
}

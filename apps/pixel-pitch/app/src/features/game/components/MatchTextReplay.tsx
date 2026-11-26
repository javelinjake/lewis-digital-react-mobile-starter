import type { FixtureResult, MatchMoment, MomentKind } from '@ld/pixel-pitch-core'
import { commentate } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useState } from 'react'
import { useOsReducedMotion } from '@/hooks/use-os-reduced-motion'
import { beatsOf } from '../lib/beats'
import { reportable } from '../lib/fixture'
import { useGameConfig } from '../queries/use-game'
import { ResultPanel } from './ResultPanel'

const LABEL: Record<MomentKind, string> = {
  kickoff: 'Kick-off',
  goal: 'Goal',
  save: 'Saved',
  miss: 'Missed',
  incident: 'On the pitch',
  halftime: 'Half-time',
  fulltime: 'Full time',
}

/** The colour of a moment once it has happened: our goals green, theirs red, the break and the whistles in the accent. */
function tone(moment: MatchMoment) {
  if (moment.kind === 'goal')
    return moment.side === 'for' ? 'text-success' : 'text-error'
  if (['kickoff', 'halftime', 'fulltime'].includes(moment.kind))
    return 'text-primary'
  return ''
}

/**
 * The match as a short written report: a few big moments, one at a time. A chance shows what is happening, then
 * what came of it. It plays itself at a readable pace; tap the card to go on sooner, or Skip to the result. When the
 * phone asks for reduced motion it never moves on its own: Next steps through it. Once `ended` (played through, skipped,
 * or a match already seen) it shows the result and the whole report, kick-off first, in a box of its own that scrolls.
 */
export function MatchTextReplay({ fixture, clubName, ended, onEnd }: { fixture: FixtureResult, clubName: string, ended: boolean, onEnd: () => void }) {
  const config = useGameConfig()
  const manual = useOsReducedMotion()
  const moments = useMemo(
    () => commentate({ clubName, fixture: reportable(fixture), config, seed: `${fixture.no}:${fixture.kickoffAt}` }),
    [clubName, fixture, config],
  )
  const beats = useMemo(() => beatsOf(moments), [moments])
  // How many beats are on screen. The kick-off is up from the start.
  const [shown, setShown] = useState(1)

  useEffect(() => {
    if (manual || shown >= beats.length)
      return
    const timer = setTimeout(() => setShown(count => Math.min(beats.length, count + 1)), beats[shown - 1].ms)
    return () => clearTimeout(timer)
  }, [manual, shown, beats])

  const finished = ended || shown >= beats.length
  useEffect(() => {
    if (shown >= beats.length && !ended)
      onEnd()
  }, [shown, beats.length, ended, onEnd])

  const beat = beats[(finished ? beats.length : shown) - 1]
  const index = beat.moment
  const moment = moments[index]
  const outcomeShown = beat.part === 'outcome' || moment.outcome === null
  const score = outcomeShown ? moment.score : (moments[index - 1]?.score ?? [0, 0])
  const earlier = moments.slice(0, index).reverse()
  const next = () => setShown(count => Math.min(beats.length, count + 1))

  const card = (
    <>
      <span className="flex items-center justify-between text-muted">
        <span className="tabular-nums">{moment.kind === 'kickoff' ? 'KO' : `${moment.minute}'`}</span>
        <span className={outcomeShown ? tone(moment) : ''}>{outcomeShown || moment.outcome === null ? LABEL[moment.kind] : 'Chance'}</span>
      </span>
      <span key={`${index}-setup`} className="text-xl leading-snug">{moment.setup}</span>
      {outcomeShown && moment.outcome !== null
        ? (
            <span
              key={`${index}-outcome`}
              className={`border-l-4 border-current pl-3 text-xl leading-snug ${tone(moment)} ${moment.kind === 'goal' ? 'font-bold' : ''}`}
              style={{ animation: manual ? 'none' : 'pp-pop 300ms steps(4)' }}
            >
              {moment.outcome}
            </span>
          )
        : null}
      {!finished && !outcomeShown && moment.outcome !== null ? <span className="text-muted" aria-hidden="true">…</span> : null}
    </>
  )

  const scoreLine = (
    <div className="flex items-center gap-2 font-display text-xs" aria-live="polite">
      <span className="min-w-0 flex-1 break-words leading-tight">{clubName}</span>
      <span className="shrink-0 whitespace-nowrap text-lg text-primary tabular-nums">{`${score[0]}–${score[1]}`}</span>
      <span className="min-w-0 flex-1 break-words text-right leading-tight">{fixture.rival.name}</span>
    </div>
  )

  if (finished) {
    return (
      <div className="flex flex-col gap-3">
        {scoreLine}
        <ResultPanel fixture={fixture} clubName={clubName} />
        <h2>Match report</h2>
        <ol className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto border-2 border-slate bg-base-100 p-3 text-lg" aria-label="Match report" tabIndex={0}>
          {moments.map(past => (
            <li key={`${past.minute}-${past.kind}-${past.setup}`} className={`flex gap-2 leading-tight ${tone(past) || 'text-muted'} ${past.kind === 'goal' ? 'border-l-4 border-current pl-2' : ''}`}>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted">{past.kind === 'kickoff' ? 'KO' : `${past.minute}'`}</span>
              <span>{past.outcome ?? past.setup}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {scoreLine}
      <button
        type="button"
        className="flex min-h-40 w-full flex-col gap-3 border-2 border-slate bg-base-100 p-4 text-left"
        aria-label="Next moment"
        onClick={next}
      >
        {card}
      </button>
      {manual
        ? <button type="button" className="btn btn-primary min-h-12 font-display text-xs" onClick={next}>Next</button>
        : <span className="text-center text-muted">Tap the match to go on</span>}

      {earlier.length > 0
        ? (
            <ol className="flex flex-col gap-2 text-lg" aria-label="Match so far">
              {earlier.map(past => (
                <li key={`${past.minute}-${past.kind}-${past.setup}`} className={`flex gap-2 leading-tight ${tone(past) || 'text-muted'} ${past.kind === 'goal' ? 'border-l-4 border-current pl-2' : ''}`}>
                  <span className="w-8 shrink-0 text-right tabular-nums text-muted">{past.kind === 'kickoff' ? 'KO' : `${past.minute}'`}</span>
                  <span>{past.outcome ?? past.setup}</span>
                </li>
              ))}
            </ol>
          )
        : null}
    </div>
  )
}

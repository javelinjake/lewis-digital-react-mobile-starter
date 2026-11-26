import type { FixtureResult, MatchMoment, MomentKind } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { commentate } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useState } from 'react'
import { useOsReducedMotion } from '@/hooks/use-os-reduced-motion'
import { beatsOf } from '../lib/beats'
import { reportable } from '../lib/fixture'
import { useGameConfig } from '../queries/use-game'
import { ResultPanel } from './ResultPanel'
import { RivalShield } from './RivalShield'

const LABEL: Record<MomentKind, string> = {
  kickoff: 'Kick-off',
  goal: 'Goal',
  save: 'Saved',
  miss: 'Missed',
  incident: 'On the pitch',
  halftime: 'Half-time',
  fulltime: 'Full time',
}

const minuteOf = (moment: MatchMoment) => (moment.kind === 'kickoff' ? 'KO' : moment.kind === 'fulltime' ? 'FT' : `${moment.minute}'`)

/** A goal's card has a bar down its left edge: green for ours, red for theirs. */
function cardStyle(moment: MatchMoment) {
  if (moment.kind === 'goal')
    return moment.side === 'for' ? 'bg-raised shadow-[inset_4px_0_0_var(--color-success),inset_0_0_0_2px_var(--color-slate)]' : 'bg-raised shadow-[inset_4px_0_0_var(--color-error),inset_0_0_0_2px_var(--color-slate)]'
  return 'bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]'
}

/** A small tag above a moment's text: GOAL in green or red, the whistles in yellow. */
function Tag({ moment, label }: { moment: MatchMoment, label: string }) {
  const colour = moment.kind === 'goal'
    ? (moment.side === 'for' ? 'bg-success text-success-content' : 'bg-error text-error-content')
    : ['kickoff', 'halftime', 'fulltime'].includes(moment.kind) ? 'bg-primary text-primary-content' : 'bg-slate text-base-content'
  return <span className={`mb-1 inline-block px-1.5 text-xs font-bold tracking-wider uppercase ${colour}`}>{label}</span>
}

/** One moment, after the fact: the minute, a tag when it matters, and what happened. */
function MomentCard({ moment }: { moment: MatchMoment }) {
  const tagged = moment.kind !== 'incident' && moment.kind !== 'save' && moment.kind !== 'miss'
  return (
    <div className={`flex gap-2.5 px-3 py-2.5 ${cardStyle(moment)}`}>
      <span className={`w-8 shrink-0 text-sm font-bold ${moment.kind === 'goal' ? (moment.side === 'for' ? 'text-success' : 'text-error') : 'text-muted'}`}>{minuteOf(moment)}</span>
      <div className="min-w-0 flex-1">
        {tagged ? <Tag moment={moment} label={LABEL[moment.kind]} /> : null}
        <div className="leading-snug">{moment.outcome ?? moment.setup}</div>
      </div>
    </div>
  )
}

/**
 * The scoreboard on the grass: both sides, the score, and how far into the match it is. The score is announced as it
 * changes.
 */
function Scoreboard({ fixture, clubName, crest, score, minute, label }: { fixture: FixtureResult, clubName: string, crest: ReactNode, score: readonly [number, number], minute: string, label: string }) {
  const { minutes } = useGameConfig().match
  const progress = minute === 'FT' ? 1 : minute === 'KO' ? 0 : Number.parseInt(minute) / minutes
  return (
    <section className="pp-grass flex flex-col gap-2.5 px-3 pt-3 pb-3 shadow-[inset_0_0_0_3px_var(--color-slate)]" aria-label="Scoreboard">
      <span className="text-center text-xs font-semibold tracking-wider text-white uppercase">{label}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-live="polite">
        <div className="flex min-w-0 flex-col items-center text-center">
          {crest}
          <span className="w-full leading-tight font-bold break-words text-white">{clubName}</span>
        </div>
        <div className="text-5xl leading-none font-bold whitespace-nowrap text-primary tabular-nums [text-shadow:3px_3px_0_#0b1028]">{`${score[0]}–${score[1]}`}</div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <RivalShield index={fixture.rival.index} size={40} />
          <span className="w-full leading-tight font-bold break-words text-white">{fixture.rival.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="bg-base-200 px-2 text-sm font-bold text-white">{minute}</span>
        <span className="h-2 flex-1 bg-base-200"><span className="block h-2 bg-primary" style={{ width: `${progress * 100}%` }} /></span>
        <span className="text-sm font-semibold text-white">{`${minutes}'`}</span>
      </div>
    </section>
  )
}

/**
 * The match as a short written report: the scoreboard, then the big moments as cards, newest on top. A chance shows
 * what is happening, then what came of it. It plays itself at a readable pace (twice as fast at x2); tap the live card
 * to go on sooner. When the phone asks for reduced motion it never moves on its own: Next steps through it. Once
 * `ended` (played through, skipped, or a match already seen) it shows the result, who scored, and the whole report
 * from kick-off, in a box of its own that scrolls.
 */
export function MatchTextReplay({ fixture, clubName, crest, label, ended, onEnd, speed = 1 }: {
  fixture: FixtureResult
  clubName: string
  crest: ReactNode
  label: string
  ended: boolean
  onEnd: () => void
  speed?: number
}) {
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
    const timer = setTimeout(() => setShown(count => Math.min(beats.length, count + 1)), beats[shown - 1].ms / speed)
    return () => clearTimeout(timer)
  }, [manual, shown, beats, speed])

  const finished = ended || shown >= beats.length
  useEffect(() => {
    if (shown >= beats.length && !ended)
      onEnd()
  }, [shown, beats.length, ended, onEnd])

  const beat = beats[(finished ? beats.length : shown) - 1]
  const index = beat.moment
  const moment = moments[index]
  const outcomeShown = beat.part === 'outcome' || moment.outcome === null
  const score = finished ? [fixture.goalsFor, fixture.goalsAgainst] as const : outcomeShown ? moment.score : (moments[index - 1]?.score ?? [0, 0])
  const earlier = moments.slice(0, index).reverse()
  const next = () => setShown(count => Math.min(beats.length, count + 1))
  const minute = finished ? 'FT' : minuteOf(moment)

  const board = <Scoreboard fixture={fixture} clubName={clubName} crest={crest} score={score} minute={minute} label={label} />

  if (finished) {
    return (
      <div className="flex flex-col gap-3">
        {board}
        <ResultPanel fixture={fixture} clubName={clubName} />
        <h2>Match report</h2>
        <ol className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto" aria-label="Match report" tabIndex={0}>
          {moments.map(past => <li key={`${past.minute}-${past.kind}-${past.setup}`}><MomentCard moment={past} /></li>)}
        </ol>
      </div>
    )
  }

  const liveLabel = outcomeShown || moment.outcome === null ? LABEL[moment.kind] : 'Chance'
  return (
    <div className="flex flex-col gap-3">
      {board}
      <button
        type="button"
        className="flex min-h-36 w-full gap-2.5 bg-raised px-3 py-3 text-left shadow-[inset_0_0_0_3px_var(--color-primary)]"
        aria-label="Next moment"
        onClick={next}
      >
        <span className="w-8 shrink-0 text-sm font-bold text-primary">{minuteOf(moment)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span><Tag moment={outcomeShown ? moment : { ...moment, kind: 'incident' }} label={liveLabel} /></span>
          <span key={`${index}-setup`} className="text-lg leading-snug">{moment.setup}</span>
          {outcomeShown && moment.outcome !== null
            ? (
                <span
                  key={`${index}-outcome`}
                  className={`text-lg leading-snug font-bold ${moment.kind === 'goal' ? (moment.side === 'for' ? 'text-success' : 'text-error') : 'text-white'}`}
                  style={{ animation: manual ? 'none' : 'pp-pop 300ms steps(4)' }}
                >
                  {moment.outcome}
                </span>
              )
            : null}
          {!outcomeShown && moment.outcome !== null ? <span className="text-muted" aria-hidden="true">…</span> : null}
        </span>
      </button>
      {manual
        ? <button type="button" className="btn btn-primary min-h-12" onClick={next}>Next</button>
        : <span className="text-center text-sm text-muted">Tap the card to go on</span>}

      {earlier.length > 0
        ? (
            <ol className="flex flex-col gap-2" aria-label="Match so far">
              {earlier.map(past => <li key={`${past.minute}-${past.kind}-${past.setup}`}><MomentCard moment={past} /></li>)}
            </ol>
          )
        : null}
    </div>
  )
}

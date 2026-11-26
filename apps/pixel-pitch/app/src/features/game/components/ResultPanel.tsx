import type { FixtureResult } from '@ld/pixel-pitch-core'
import { art } from '../lib/art'
import { scorersOf } from '../lib/fixture'
import { NextSteps } from './NextSteps'

/**
 * What a match paid and who scored, shown when it ends. Shared by the pitch and text views. The way on (Continue) is
 * pinned to the bottom of the screen by the match view.
 */
export function ResultPanel({ fixture, clubName }: { fixture: FixtureResult, clubName: string }) {
  const scorers = scorersOf(fixture)
  const friendly = fixture.no < 0
  return (
    <div className="flex flex-col items-center gap-2 border-2 border-primary bg-base-100 p-4">
      <img src={art(`text/banner_${fixture.result}.png`)} alt={fixture.result} className="pixel h-auto w-40" />
      <span className="text-xl">{`+${fixture.coins} coins${fixture.points ? ` · +${fixture.points} pts` : ''}`}</span>
      {friendly ? <span className="text-muted">A friendly: coins, but no league points.</span> : null}
      {fixture.warmupBonus > 0 ? <span className="text-muted">{`Your warm-up gave +${Math.round(fixture.warmupBonus * 100)}% attack.`}</span> : null}
      {fixture.promotedTo ? <img src={art('text/banner_promoted.png')} alt="Promoted" className="pixel h-auto w-48" /> : null}
      {scorers.length > 0
        ? (
            <div className="grid w-full grid-cols-2 gap-x-3 text-lg" aria-label="Scorers">
              <span className="truncate font-display text-xs">{clubName}</span>
              <span className="truncate text-right font-display text-xs">{fixture.rival.name}</span>
              <ul className="flex flex-col">
                {scorers.filter(goal => goal.side === 'for').map(goal => <li key={`f${goal.minute}${goal.name}`} className="text-success">{`${goal.name} ${goal.minute}'`}</li>)}
              </ul>
              <ul className="flex flex-col text-right">
                {scorers.filter(goal => goal.side === 'against').map(goal => <li key={`a${goal.minute}${goal.name}`} className="text-error">{`${goal.name} ${goal.minute}'`}</li>)}
              </ul>
            </div>
          )
        : <span className="text-muted">No goals.</span>}
      {friendly ? null : <NextSteps />}
    </div>
  )
}

import type { FixtureResult } from '@ld/pixel-pitch-core'
import { art } from '../lib/art'

/** What a match paid, shown when it ends. Shared by the pitch and text views. */
export function ResultPanel({ fixture, onDone }: { fixture: FixtureResult, onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 border-2 border-primary bg-base-100 p-4">
      <img src={art(`text/banner_${fixture.result}.png`)} alt={fixture.result} className="pixel h-auto w-40" />
      <span className="text-xl">{`+${fixture.coins} coins${fixture.points ? ` · +${fixture.points} pts` : ''}`}</span>
      {fixture.promotedTo ? <img src={art('text/banner_promoted.png')} alt="Promoted" className="pixel h-auto w-48" /> : null}
      <button type="button" className="btn btn-primary min-h-11 w-full font-display text-xs" onClick={onDone}>Continue</button>
    </div>
  )
}

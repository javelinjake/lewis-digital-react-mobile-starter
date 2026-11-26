import type { NewClub } from '@ld/pixel-pitch-core'
import { BottomActions } from '@ld/mobile-ui'
import { CREST_BASES, CREST_EMBLEMS } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { telemetry } from '@/lib/telemetry/telemetry'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { KIT_COLOURS } from '../lib/art'
import { useGameAction } from '../mutations/use-game-action'
import { Crest } from './sprites'

const NAME_IDEAS = ['Harbour Town', 'Northgate Rovers', 'Kestrel Athletic', 'Millbrook United', 'Copper Lane FC']
const NAME_MAX = 24
const SHAPE_NAMES: Record<typeof CREST_BASES[number], string> = { shield: 'Shield', round: 'Round', square: 'Square', pennant: 'Pennant' }
const SYMBOL_NAMES: Record<typeof CREST_EMBLEMS[number], string> = { ball: 'Ball', bolt: 'Bolt', crown: 'Crown', flame: 'Flame', star: 'Star', tree: 'Tree', wave: 'Wave', wings: 'Wings' }

const choice = (on: boolean) => (on ? 'bg-raised shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]')

/**
 * Name the club, pick a kit and a crest (a shape and a symbol). The crest is drawn in the kit's colours as you go. The
 * server signs a starter squad and plays the first match.
 */
export function OnboardingScreen() {
  const toast = useToast()
  const [name, setName] = useState(() => NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)])
  const [shape, setShape] = useState(0)
  const [symbol, setSymbol] = useState(0)
  const [kit, setKit] = useState(0)
  const create = useGameAction((input: NewClub) => gameApi.createClub(input))
  const [primary, secondary] = KIT_COLOURS[kit]
  const colours = [primary, secondary] as const
  const crest = shape * CREST_EMBLEMS.length + symbol
  const valid = name.trim().length >= 2 && name.trim().length <= NAME_MAX

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid)
          return
        // On success the new club lands in the cache and the onboarding gate moves on to the debut replay.
        create.mutate({ name: name.trim(), crest, kitPrimary: primary, kitSecondary: secondary }, {
          onSuccess: () => telemetry.track('club_founded'),
          onError: error => toast.push(formatError(error), 'error'),
        })
      }}
    >
      <div className="pp-grass flex flex-col items-center gap-2 py-4 shadow-[inset_0_0_0_3px_var(--color-slate)]">
        <Crest crest={crest} kit={colours} scale={5} label="Your crest" />
        <h2 className="px-3 text-center text-2xl text-white [text-shadow:2px_2px_0_#0b1028]">{name.trim() || 'Your club'}</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="club-name" className="flex items-baseline justify-between">
          <span className="pp-label">Club name</span>
          <span className="text-sm text-muted tabular-nums" aria-hidden="true">{`${name.length} / ${NAME_MAX}`}</span>
        </label>
        <input
          id="club-name"
          className="input w-full border-0 bg-base-100 text-xl shadow-[inset_0_0_0_2px_var(--color-slate)] focus:shadow-[inset_0_0_0_3px_var(--color-primary)]"
          value={name}
          maxLength={NAME_MAX}
          onChange={event => setName(event.target.value)}
          autoComplete="off"
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pp-label mb-1.5">Kit</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Kit colours">
          {KIT_COLOURS.map(([one, two, label], index) => (
            <button key={label} type="button" role="radio" aria-label={label} aria-checked={index === kit} className={`flex h-12 p-1.5 ${choice(index === kit)}`} onClick={() => setKit(index)}>
              <span className="flex-1" style={{ background: one }} />
              <span className="flex-1" style={{ background: two }} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pp-label mb-1.5">Crest shape</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Crest shape">
          {CREST_BASES.map((base, index) => (
            <button key={base} type="button" role="radio" aria-checked={index === shape} className={`flex min-h-18 flex-col items-center justify-center gap-1 ${choice(index === shape)}`} onClick={() => setShape(index)}>
              <Crest crest={index * CREST_EMBLEMS.length + symbol} kit={colours} scale={2} />
              <span className="text-sm">{SHAPE_NAMES[base]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pp-label mb-1.5">Symbol</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Crest symbol">
          {CREST_EMBLEMS.map((emblem, index) => (
            <button key={emblem} type="button" role="radio" aria-label={SYMBOL_NAMES[emblem]} aria-checked={index === symbol} className={`flex min-h-14 items-center justify-center ${choice(index === symbol)}`} onClick={() => setSymbol(index)}>
              <Crest crest={shape * CREST_EMBLEMS.length + index} kit={colours} scale={2} />
            </button>
          ))}
        </div>
      </fieldset>

      <BottomActions>
        <button type="submit" className="btn btn-primary h-13 text-xl" disabled={!valid || create.isPending}>
          {create.isPending ? 'Signing players…' : 'Found the club'}
        </button>
      </BottomActions>
    </form>
  )
}

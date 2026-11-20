import type { NewClub } from '@ld/pixel-pitch-core'
import { CREST_COUNT } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { KIT_COLOURS } from '../lib/art'
import { useGameAction } from '../mutations/use-game-action'
import { Crest } from './sprites'

const NAME_IDEAS = ['Harbour Town', 'Northgate Rovers', 'Kestrel Athletic', 'Millbrook United', 'Copper Lane FC']

/** Name the club, pick a crest and kit. The server signs a starter squad and plays the first match, which you win. */
export function OnboardingScreen() {
  const toast = useToast()
  const [name, setName] = useState(() => NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)])
  const [crest, setCrest] = useState(0)
  const [kit, setKit] = useState(0)
  const create = useGameAction((input: NewClub) => gameApi.createClub(input))
  const [primary, secondary] = KIT_COLOURS[kit]
  const valid = name.trim().length >= 2 && name.trim().length <= 24

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid)
          return
        // On success the new club lands in the cache and the onboarding gate moves on to the debut replay.
        create.mutate({ name: name.trim(), crest, kitPrimary: primary, kitSecondary: secondary }, {
          onError: error => toast.push(formatError(error), 'error'),
        })
      }}
    >
      <div className="flex flex-col items-center gap-3 pt-2">
        <Crest crest={crest} kit={[primary, secondary]} scale={5} label="Your crest" />
        <h2 className="text-center text-primary">{name.trim() || 'Your club'}</h2>
      </div>

      <label className="flex flex-col gap-1">
        <span>Club name</span>
        <input className="input input-bordered w-full text-xl" value={name} maxLength={24} onChange={event => setName(event.target.value)} autoComplete="off" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">Kit</legend>
        <div className="grid grid-cols-4 gap-2">
          {KIT_COLOURS.map(([one, two, label], index) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-pressed={index === kit}
              className={`flex h-11 border-2 ${index === kit ? 'border-primary' : 'border-base-300'}`}
              onClick={() => setKit(index)}
            >
              <span className="flex-1" style={{ background: one }} />
              <span className="flex-1" style={{ background: two }} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">Crest</legend>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: CREST_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Crest ${index + 1}`}
              aria-pressed={index === crest}
              className={`flex min-h-11 items-center justify-center border-2 ${index === crest ? 'border-primary bg-base-300' : 'border-transparent'}`}
              onClick={() => setCrest(index)}
            >
              <Crest crest={index} kit={[primary, secondary]} scale={2} />
            </button>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary min-h-12 font-display text-xs" disabled={!valid || create.isPending}>
        {create.isPending ? 'Signing players…' : 'Found the club'}
      </button>
    </form>
  )
}

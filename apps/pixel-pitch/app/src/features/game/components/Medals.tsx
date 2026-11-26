import type { Medal } from '@ld/pixel-pitch-core'
import { MEDALS } from '@ld/pixel-pitch-core'
import { MEDAL_NAME as NAME } from '../lib/medals'

const COLOUR: Record<Medal, string> = { bronze: '#c07a3a', silver: '#c9d1dc', gold: 'var(--color-warning)' }

/** Three medal pips, filled up to the one held (0 to 3). */
export function MedalPips({ level, label }: { level: number, label?: string }) {
  const held = level > 0 ? NAME[MEDALS[level - 1]] : 'No medal'
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={label ? `${label}: ${held}` : held}>
      {MEDALS.map((medal, index) => (
        <span
          key={medal}
          className="inline-block size-3"
          style={index < level ? { background: COLOUR[medal] } : { boxShadow: 'inset 0 0 0 2px var(--color-slate)' }}
        />
      ))}
    </span>
  )
}

/** The three targets, each with its pip, the ones reached filled. */
export function MedalTargets({ targets, level }: { targets: readonly number[], level: number }) {
  return (
    <ul className="flex gap-3" aria-label="Medal targets">
      {MEDALS.map((medal, index) => (
        <li key={medal} className="flex items-center gap-1.5 tabular-nums">
          <span className="inline-block size-3" style={index < level ? { background: COLOUR[medal] } : { boxShadow: `inset 0 0 0 2px ${COLOUR[medal]}` }} />
          {`${NAME[medal]} ${targets[index]}`}
        </li>
      ))}
    </ul>
  )
}

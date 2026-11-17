import type { ChallengeDefinition } from '@/game/challenges/types'
import type { ProgressRecord } from '@/game/persistence/types'
import type { AssistMode } from '@/game/vehicle/physics-config'
import { Icon } from '@/components/ui/Icon'
import { awardOf, formatPrimary, progressFor } from '../lib/best'

/** Placeholder card art per challenge: a gradient and a simple motif standing in for the board's photos. */
const ART: Record<string, { bg: string, motif: string }> = {
  kitchen_sprint: { bg: 'linear-gradient(180deg,#bfe3ff,#ffe9c6 55%,#d8e2ea)', motif: 'M0 40 L100 78 L100 100 L0 100Z' },
  kitchen_acceleration: { bg: 'linear-gradient(180deg,#fff0d2,#e7edf3 55%,#c9d4df)', motif: 'M0 74 L100 74 L100 100 L0 100Z M10 82 h16 M38 82 h16 M66 82 h16' },
  kitchen_braking: { bg: 'linear-gradient(180deg,#ffeccc,#e4ecf3 55%,#c9d4df)', motif: 'M34 66 h46 v26 h-46z' },
  kitchen_drift: { bg: 'linear-gradient(180deg,#ffe8c2,#e2eaf2 55%,#c5d1dc)', motif: 'M0 92 Q70 92 84 40 L100 40 L100 100 L0 100Z' },
  kitchen_coast: { bg: 'linear-gradient(180deg,#fff1d6,#e6edf4 55%,#c8d3de)', motif: 'M0 78 L100 70 L100 100 L0 100Z M60 62 v14' },
  garden_mud: { bg: 'linear-gradient(180deg,#9bd7ff,#c8efc0 45%,#6b4423 46%,#4a2f17)', motif: 'M0 68 Q30 62 50 70 T100 66 L100 100 L0 100Z' },
  garden_climb: { bg: 'linear-gradient(180deg,#8ecfff,#d2f0ff 40%,#5fae45 42%,#3f8b33)', motif: 'M0 100 L0 84 L100 36 L100 100Z' },
  garden_jump: { bg: 'linear-gradient(180deg,#86caff,#d6f1ff 40%,#5fae45 44%,#3f8b33)', motif: 'M0 88 L58 88 L82 60 L84 66 L66 90 L100 90 L100 100 L0 100Z' },
}

export function ChallengeCard({
  def,
  selected,
  assist,
  progress,
  carThumb,
  onSelect,
}: {
  def: ChallengeDefinition
  selected: boolean
  assist: AssistMode
  progress: readonly ProgressRecord[]
  carThumb?: string
  onSelect: () => void
}) {
  const record = progressFor(def, assist, progress)
  const award = awardOf(record)
  const art = ART[def.id] ?? ART.kitchen_sprint!
  const best = record?.bestValue ?? null
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${def.name}. ${def.objective}${best !== null ? ` Best ${formatPrimary(def, best)}.` : ''}`}
      className={`br-card ch-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="ch-art">
        <span className="ch-bg" style={{ background: art.bg }} />
        <svg className="ch-motif" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={art.motif} fill="rgba(255,255,255,0.28)" stroke="rgba(0,0,0,0.12)" strokeWidth="0.8" />
        </svg>
        {carThumb && <img className="ch-car" src={carThumb} alt="" draggable={false} />}
        <span className="br-chip ch-title">
          <Icon name="flag" size={18} /> {def.shortName}
        </span>
        {award !== 'none' && (
          <span className={`ch-award ${award === 'great' ? 'is-great' : ''}`}>
            <Icon name="check" size={13} /> {award === 'great' ? 'Great' : 'Done'}
          </span>
        )}
      </span>
      <span className="br-caption ch-caption">
        <span>{def.tagline}</span>
        {best !== null && (
          <>
            <span aria-hidden="true">|</span>
            <span>Best <b>{formatPrimary(def, best)}</b></span>
          </>
        )}
      </span>
    </button>
  )
}

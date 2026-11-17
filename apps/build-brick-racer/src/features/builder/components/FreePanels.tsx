import type { WheelRolePatch } from '@/game/build/edit'
import type { CarDocument, Forward, WheelGroup } from '@/game/build/types'
import type { DriveAssessment } from '@/game/vehicle/analysis'
import { Icon } from '@/components/ui/Icon'

export type FreeTab = 'inspect' | 'wheels' | 'front'

interface FreePanelsProps {
  tab: FreeTab
  onTab: (tab: FreeTab) => void
  onClose: () => void
  doc: CarDocument
  assessment: DriveAssessment | null
  looseCount: number
  showContacts: boolean
  onToggleContacts: () => void
  groupLabels: Map<string, string>
  onRoles: (groupId: string, patch: WheelRolePatch) => void
  onFocusGroup: (group: WheelGroup) => void
  onForward: (forward: Forward) => void
}

const TABS: Array<{ id: FreeTab, label: string, icon: React.ComponentProps<typeof Icon>['name'] }> = [
  { id: 'inspect', label: 'Inspect', icon: 'eye' },
  { id: 'wheels', label: 'Wheels', icon: 'wheel' },
  { id: 'front', label: 'Front', icon: 'flag' },
]

const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : 'Not measured')

function Row({ label, value, note }: { label: string, value: string, note?: string }) {
  return (
    <div className="bd-row">
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <small>{note}</small>}
      </dd>
    </div>
  )
}

function Bar({ label, value, max }: { label: string, value: number, max: number }) {
  return (
    <div className="bd-bar">
      <span>{label}</span>
      <div className="bd-bar-track"><i style={{ width: `${Math.min(100, (value / Math.max(max, 1e-6)) * 100)}%` }} /></div>
      <b>
        {value.toFixed(3)}
        {' '}
        m²
      </b>
    </div>
  )
}

/** "Estimated airflow": the game's simplified model, shown as projected areas and a flow-line silhouette. */
function Airflow({ front, side, top, size }: { front: number, side: number, top: number, size: readonly [number, number, number] }) {
  const max = Math.max(front, side, top)
  const h = Math.max(0.05, size[1])
  const l = Math.max(0.1, size[2])
  const w = 120
  const bodyH = Math.min(36, (h / l) * w)
  return (
    <figure className="bd-airflow" aria-label="Estimated airflow">
      <svg viewBox="0 0 160 64" width="100%" height="64" role="img" aria-label="Side silhouette with airflow lines">
        <rect x="20" y={46 - bodyH} width={w} height={bodyH} rx="6" fill="#ff7a1a" opacity="0.85" />
        <circle cx="42" cy="48" r="8" fill="#1c1c20" />
        <circle cx={20 + w - 22} cy="48" r="8" fill="#1c1c20" />
        {[12, 26, 40].map((y, i) => (
          <path key={y} className="bd-flow" d={`M2 ${y} C 40 ${y - 6}, 110 ${y - 6}, 158 ${y + 2}`} fill="none" stroke="#7ff0ff" strokeWidth="2" strokeDasharray="8 8" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </svg>
      <Bar label="Front" value={front} max={max} />
      <Bar label="Side" value={side} max={max} />
      <Bar label="Top" value={top} max={max} />
      <figcaption>Estimated airflow in this game’s model. Real test results come from driving.</figcaption>
    </figure>
  )
}

function Inspect({ doc, assessment, looseCount, showContacts, onToggleContacts }: Pick<FreePanelsProps, 'doc' | 'assessment' | 'looseCount' | 'showContacts' | 'onToggleContacts'>) {
  const d = assessment?.derived
  const measured = Boolean(d && d.wheelCount > 0)
  const tip = d?.tipAngleDeg ?? 0
  const steady = tip >= 28
  return (
    <div>
      <dl className="bd-rows" data-testid="inspect">
        <Row label="Pieces" value={String(doc.instances.length)} note={looseCount > 0 ? `${looseCount} loose` : undefined} />
        <Row label="Weight" value={d ? `${fmt(d.massKg)} kg` : 'Working it out…'} note={d && d.totalMassKg > d.massKg + 1e-6 ? `${fmt(d.totalMassKg)} kg with loose` : undefined} />
        <Row label="Size" value={measured && d ? `${d.sizeM.map(v => fmt(v)).join(' × ')} m` : 'Not measured'} note="width × height × length" />
        <Row label="Weight height" value={measured && d ? `${fmt(d.centreOfMassHeightM)} m` : 'Not measured'} note="centre of mass above the ground" />
        <Row
          label="Steadiness"
          value={measured ? `${tip.toFixed(0)}°` : 'Not measured'}
          note={measured ? (steady ? 'Steady' : 'Tippy') : 'Add wheels on a mount'}
        />
        <Row label="Ground gap" value={measured && d ? `${fmt(d.clearanceM)} m` : 'Not measured'} />
      </dl>
      <label className="bd-check">
        <input type="checkbox" className="toggle br-toggle" checked={showContacts} onChange={onToggleContacts} data-testid="toggle-contacts" />
        <span>Show wheel contacts and balance</span>
      </label>
      {showContacts && <p className="bd-note">Blue dots are where the wheels touch the ground. The ball is the weight centre: green when it sits inside the blue outline.</p>}
      {d && measured && <Airflow front={d.airflow.front} side={d.airflow.side} top={d.airflow.top} size={d.sizeM} />}
    </div>
  )
}

function Wheels({ doc, groupLabels, onRoles, onFocusGroup }: Pick<FreePanelsProps, 'doc' | 'groupLabels' | 'onRoles' | 'onFocusGroup'>) {
  if (doc.wheelGroups.length === 0)
    return <p className="bd-note">No wheels yet. Put a wheel on a wheel mount or axle beam and its group appears here.</p>
  return (
    <ul className="bd-groups" data-testid="wheel-groups">
      {doc.wheelGroups.map(g => (
        <li key={g.id} className="bd-group">
          <button type="button" className="bd-group-head" onClick={() => onFocusGroup(g)}>
            <Icon name="wheel" size={18} />
            <b>{groupLabels.get(g.id) ?? 'Axle'}</b>
            <small>
              {g.instanceIds.length}
              {' '}
              wheel
              {g.instanceIds.length === 1 ? '' : 's'}
            </small>
          </button>
          {([['driven', 'Drive'], ['steering', 'Steer'], ['braking', 'Brake']] as const).map(([key, label]) => (
            <label key={key} className="bd-check">
              <input type="checkbox" className="toggle br-toggle" checked={g[key]} data-testid={`role-${key}-${g.id}`} onChange={() => onRoles(g.id, { [key]: !g[key] })} />
              <span>{label}</span>
            </label>
          ))}
          {g.steering && (
            <label className="bd-check">
              <input type="checkbox" className="toggle br-toggle" checked={g.steerDirection === -1} onChange={() => onRoles(g.id, { steerDirection: g.steerDirection === 1 ? -1 : 1 })} />
              <span>Steer the other way</span>
            </label>
          )}
        </li>
      ))}
    </ul>
  )
}

const COMPASS: Array<{ forward: Forward, label: string, icon: React.ComponentProps<typeof Icon>['name'], area: string }> = [
  { forward: 'z-', label: 'Front points up the grid', icon: 'arrow-up', area: 'n' },
  { forward: 'x-', label: 'Front points left', icon: 'arrow-left', area: 'w' },
  { forward: 'x+', label: 'Front points right', icon: 'arrow-right', area: 'e' },
  { forward: 'z+', label: 'Front points down the grid', icon: 'arrow-down', area: 's' },
]

function Front({ doc, onForward }: Pick<FreePanelsProps, 'doc' | 'onForward'>) {
  return (
    <div>
      <p className="bd-note">Pick the way the front of your car points. The orange arrow on the floor shows it. The car never guesses this from its shape.</p>
      <div className="bd-compass" role="radiogroup" aria-label="Front of the car">
        {COMPASS.map(c => (
          <button
            key={c.forward}
            type="button"
            role="radio"
            aria-checked={doc.forward === c.forward}
            aria-label={c.label}
            data-testid={`front-${c.forward}`}
            className={`bd-compass-btn ${doc.forward === c.forward ? 'is-on' : ''}`}
            style={{ gridArea: c.area }}
            onClick={() => onForward(c.forward)}
          >
            <Icon name={c.icon} size={28} />
          </button>
        ))}
        <span className="bd-compass-car" style={{ gridArea: 'c' }} aria-hidden="true"><Icon name="car" size={26} /></span>
      </div>
    </div>
  )
}

export function FreePanels(p: FreePanelsProps) {
  return (
    <aside className="bd-freepanel br-panel" aria-label="Free Build panels" data-testid="free-panel">
      <div className="bd-freetabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={p.tab === t.id} className={`br-tab bd-chip ${p.tab === t.id ? 'is-active' : ''}`} data-testid={`ftab-${t.id}`} onClick={() => p.onTab(t.id)}>
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </button>
        ))}
        <button type="button" className="bd-x" aria-label="Close panel" onClick={p.onClose}><Icon name="close" size={20} /></button>
      </div>
      <div className="bd-freebody br-scroll">
        {p.tab === 'inspect' && <Inspect doc={p.doc} assessment={p.assessment} looseCount={p.looseCount} showContacts={p.showContacts} onToggleContacts={p.onToggleContacts} />}
        {p.tab === 'wheels' && <Wheels doc={p.doc} groupLabels={p.groupLabels} onRoles={p.onRoles} onFocusGroup={p.onFocusGroup} />}
        {p.tab === 'front' && <Front doc={p.doc} onForward={p.onForward} />}
      </div>
    </aside>
  )
}

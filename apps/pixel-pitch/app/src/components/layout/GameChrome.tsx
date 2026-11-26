import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

/** A 10×10 pixel icon drawn in the text colour, so it follows the active and muted states. */
export function PixelIcon({ d, size = 24, viewBox = '0 0 10 10' }: { d: string, size?: number, viewBox?: string }) {
  return (
    <svg viewBox={viewBox} width={size} height={size} shapeRendering="crispEdges" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export const ICONS = {
  back: { d: 'M0 3h1V2h1V1h1V0h1v7H3V6H2V5H1V4H0zM4 3h4v1H4z', viewBox: '0 0 8 7' },
  settings: { d: 'M3 0h2v1h1v1h1v1h1v2H7v1H6v1H5v1H3V7H2V6H1V5H0V3h1V2h1V1h1zM3 3v2h2V3z', viewBox: '0 0 8 8' },
  goals: { d: 'M0 0h10v10H0zM1 1v8h8V1zM7 2h1v1h1v1H8v1H7v1H6v1H5v1H4V7H3V6H2V5h1v1h1v1h1V6h1V5h1V4h1V3H7z', viewBox: '0 0 10 10' },
  club: { d: 'M4 0h2v1h1v1h1v1h1v1h1v1H9v5H6V7H4v3H1V5H0V4h1V3h1V2h1V1h1z', viewBox: '0 0 10 10' },
  packs: { d: 'M1 2h5v8H1zM4 0h5v8H7V1H4z', viewBox: '0 0 10 10' },
  squad: { d: 'M2 0h2v1h2V0h2v1h1v1h1v2H8v6H2V4H0V2h1V1h1z', viewBox: '0 0 10 10' },
  arcade: { d: 'M4 0h2v1h1v2H6v3h3v1h1v3H0V7h1V6h3V3H3V1h1zM2 8v1h2V8zM6 8v1h1V8zM8 8v1h1V8z', viewBox: '0 0 10 10' },
  league: { d: 'M1 0h8v2h1v2H9v1H8v1H6v2h2v2H2V8h2V6H2V5H1V4H0V2h1z', viewBox: '0 0 10 10' },
} as const

export type IconName = keyof typeof ICONS

/** A red count on an icon: things waiting there. Nothing for 0. */
function Badge({ count, labelled = false }: { count: number, labelled?: boolean }) {
  if (count <= 0)
    return null
  return (
    <span
      className="absolute -right-1 -top-1 min-w-5 bg-error px-1 text-center text-xs font-bold leading-5 text-error-content"
      style={{ boxShadow: '0 0 0 2px var(--color-chrome)' }}
      {...(labelled ? { 'aria-label': `${count} waiting` } : { 'aria-hidden': true })}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

/** A square bevelled button in the header, for Goals and Settings. */
export function HeaderButton({ to, label, icon, count = 0 }: { to: string, label: string, icon: IconName, count?: number }) {
  return (
    <Link
      to={to}
      aria-label={count > 0 ? `${label}, ${count} waiting` : label}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center bg-raised text-muted"
      style={{ boxShadow: 'inset -3px -3px 0 #0b1028, inset 3px 3px 0 var(--color-slate-light)' }}
    >
      <PixelIcon d={ICONS[icon].d} viewBox={ICONS[icon].viewBox} size={20} />
      <Badge count={count} />
    </Link>
  )
}

/**
 * The Floodlight header: an optional back button or crest, the title (yellow on the club's own screen) with a line
 * under it, buttons on the right, and an optional bar under it (the club's money).
 */
export function ScreenHeader({ title, sub, onBack, crest, end, below, highlight = false }: {
  title: string
  sub?: ReactNode
  onBack?: () => void
  crest?: ReactNode
  end?: ReactNode
  below?: ReactNode
  highlight?: boolean
}) {
  return (
    <header
      className="sticky top-0 z-20 shrink-0 border-b-4 border-slate bg-chrome px-4 pb-3"
      style={{ paddingTop: 'calc(0.625rem + var(--safe-top))' }}
    >
      <div className="flex min-h-11 items-center gap-3">
        {onBack
          ? (
              <button type="button" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center" onClick={onBack} aria-label="Back">
                <PixelIcon d={ICONS.back.d} viewBox={ICONS.back.viewBox} size={20} />
              </button>
            )
          : null}
        {crest}
        <div className="min-w-0 flex-1">
          <h1 className={`truncate ${highlight ? 'text-primary' : ''}`}>{title}</h1>
          {sub ? <div className="truncate text-sm text-muted">{sub}</div> : null}
        </div>
        {end}
      </div>
      {below ? <div className="mt-2.5">{below}</div> : null}
    </header>
  )
}

export interface IconTab {
  to: string
  label: string
  icon: IconName
  /** Things waiting on that tab. */
  badge?: number
}

/** The Floodlight tab bar: a pixel icon over each label, the current tab lit yellow with a bar along its top. */
export function IconTabBar({ items }: { items: IconTab[] }) {
  return (
    <nav aria-label="Primary" className="flex shrink-0 border-t-4 border-slate bg-chrome" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-sm font-semibold ${isActive ? 'bg-raised text-primary shadow-[inset_0_4px_0_var(--color-primary)]' : 'text-muted'}`}
        >
          <span className="relative">
            <PixelIcon d={ICONS[item.icon].d} viewBox={ICONS[item.icon].viewBox} />
            <Badge count={item.badge ?? 0} labelled />
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

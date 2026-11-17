import type { ReactNode } from 'react'

/** The cyan `///` and orange `///` slash motif from the design boards. */
export function Stripes({ orange = false, count = 3 }: { orange?: boolean, count?: number }) {
  return (
    <span className={`br-stripes ${orange ? 'is-orange' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} />)}
    </span>
  )
}

/** Title bar used on every screen: left slot, centred chamfered title, right slot. */
export function ScreenHeader({ title, left, right }: { title: ReactNode, left?: ReactNode, right?: ReactNode }) {
  return (
    <header className="br-header br-layer">
      <div className="flex min-w-14 items-center justify-start">{left}</div>
      <h1 className="br-panel br-title justify-self-center">
        <Stripes />
        <span>{title}</span>
        <Stripes orange />
      </h1>
      <div className="flex min-w-14 items-center justify-end gap-2">{right}</div>
    </header>
  )
}

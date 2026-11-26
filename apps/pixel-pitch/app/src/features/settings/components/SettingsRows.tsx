import type { ReactNode } from 'react'

/** A group of settings: a small caps title over one panel of rows. */
export function SettingsGroup({ label, children }: { label: string, children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={label}>
      <h2 className="pp-label">{label}</h2>
      <ul className="flex flex-col bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)] [&>li+li]:border-t-2 [&>li+li]:border-slate">{children}</ul>
    </section>
  )
}

function Text({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-lg">{title}</span>
      {subtitle ? <span className="block text-sm text-muted">{subtitle}</span> : null}
    </span>
  )
}

/** One setting. With `onClick` it is a button that goes on (a ›); without, it only shows a value. */
export function SettingsRow({ title, subtitle, onClick, destructive = false }: { title: string, subtitle?: string, onClick?: () => void, destructive?: boolean }) {
  if (!onClick) {
    return (
      <li className="flex min-h-14 items-center gap-3 px-3.5 py-2">
        <Text title={title} subtitle={subtitle} />
      </li>
    )
  }
  return (
    <li>
      <button type="button" className={`flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left ${destructive ? 'text-error' : ''}`} onClick={onClick}>
        <Text title={title} subtitle={subtitle} />
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </button>
    </li>
  )
}

/** A setting that is on or off: a pixel switch, green when on. */
export function SettingsSwitch({ title, subtitle, on, onChange }: { title: string, subtitle?: string, on: boolean, onChange: (on: boolean) => void }) {
  return (
    <li>
      <button type="button" role="switch" aria-checked={on} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left" onClick={() => onChange(!on)}>
        <Text title={title} subtitle={subtitle} />
        <span className={`relative h-7 w-13 shrink-0 ${on ? 'bg-success shadow-[inset_0_0_0_2px_#0b1028]' : 'bg-base-200 shadow-[inset_0_0_0_2px_var(--color-slate-light)]'}`} aria-hidden="true">
          <span className={`absolute top-1 h-5 w-5 ${on ? 'left-7 bg-base-200' : 'left-1 bg-muted'}`} />
        </span>
      </button>
    </li>
  )
}

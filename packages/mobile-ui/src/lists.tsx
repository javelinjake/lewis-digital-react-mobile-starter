import type { ReactNode } from 'react'
import { useRef } from 'react'
import { NavLink } from 'react-router'

export function ListGroup({ children, label }: { children: ReactNode, label?: string }) {
  return (
    <section className="overflow-hidden rounded-box bg-base-100" aria-label={label}>
      <ul className="divide-y divide-base-300">{children}</ul>
    </section>
  )
}

export function ListItem({
  title,
  subtitle,
  to,
  onClick,
  end,
}: {
  title: string
  subtitle?: string
  to?: string
  onClick?: () => void
  end?: ReactNode
}) {
  const content = (
    <span className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <span>
        <span className="block font-medium">{title}</span>
        {subtitle ? <span className="block text-sm opacity-70">{subtitle}</span> : null}
      </span>
      {end}
    </span>
  )

  if (to) {
    return (
      <li>
        <NavLink to={to} className="block">{content}</NavLink>
      </li>
    )
  }

  if (onClick) {
    return (
      <li>
        <button type="button" className="block w-full" onClick={onClick}>{content}</button>
      </li>
    )
  }

  return <li>{content}</li>
}

export function Fab({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-primary btn-circle fixed right-4 z-30 min-h-14 min-w-14 text-2xl shadow-lg"
      style={{ bottom: 'calc(4.5rem + var(--safe-bottom))' }}
      onClick={onClick}
      aria-label={label}
    >
      +
    </button>
  )
}

export function OfflineBanner({ offline, pendingCount }: { offline: boolean, pendingCount: number }) {
  if (!offline && pendingCount === 0)
    return null

  const message = offline
    ? `You are offline${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
    : `${pendingCount} pending`

  return (
    <div role="status" className="bg-warning px-4 py-2 text-center text-sm text-warning-content">
      {message}
    </div>
  )
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string, label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div role="tablist" className="flex rounded-box bg-base-200 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`min-h-11 flex-1 rounded-box text-sm ${option.value === value ? 'bg-base-100 font-semibold' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open)
    return null

  return (
    <div className="fixed inset-0 z-40 flex items-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-4"
        style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
      >
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function ActionSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean
  title: string
  actions: Array<{ label: string, onSelect: () => void, destructive?: boolean }>
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            className={`btn min-h-11 ${action.destructive ? 'btn-error' : 'btn-ghost'}`}
            onClick={() => {
              action.onSelect()
              onClose()
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

export function PullToRefresh({ children, onRefresh }: { children: ReactNode, onRefresh: () => Promise<void> | void }) {
  const startY = useRef<number | null>(null)

  return (
    <div
      onTouchStart={(event) => {
        if (window.scrollY <= 0)
          startY.current = event.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(event) => {
        const start = startY.current
        startY.current = null
        const end = event.changedTouches[0]?.clientY ?? 0
        if (start !== null && end - start > 72)
          void onRefresh()
      }}
    >
      {children}
    </div>
  )
}

export function SwipeActions({ children, actionLabel, onAction }: { children: ReactNode, actionLabel: string, onAction: () => void }) {
  return (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" className="btn btn-error min-h-11 rounded-none" onClick={onAction}>{actionLabel}</button>
    </div>
  )
}

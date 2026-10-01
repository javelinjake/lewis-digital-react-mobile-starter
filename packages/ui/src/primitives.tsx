import type { ReactNode } from 'react'

export function MotionFade({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <div className={`ld-fade-in ${className}`}>{children}</div>
}

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-base-200 p-6" role="status">
      <span className="loading loading-spinner loading-md" />
      <span className="ml-3">{message}</span>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string, body?: string }) {
  return (
    <div className="rounded-box bg-base-100 p-6 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {body ? <p className="mt-2 text-sm opacity-70">{body}</p> : null}
    </div>
  )
}

export function ErrorState({ title, body }: { title: string, body?: string }) {
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {body ? <p className="text-sm">{body}</p> : null}
      </div>
    </div>
  )
}

export function InlineAlert({ children }: { children: ReactNode }) {
  return <div className="alert alert-info text-sm">{children}</div>
}

export function StatusBadge({ children, pending = false }: { children: ReactNode, pending?: boolean }) {
  return <span className={`badge badge-sm ${pending ? 'badge-warning' : 'badge-ghost'}`}>{children}</span>
}

export function ThemeToggle({ theme, onToggle }: { theme: string, onToggle: () => void }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle} aria-label="Toggle theme">
      {theme === 'dracula' ? 'Light' : 'Dark'}
    </button>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open)
    return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-box bg-base-100 p-4">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm opacity-80">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-error" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

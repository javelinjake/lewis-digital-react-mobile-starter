import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ScreenHeader } from '@/components/ui/ScreenHeader'

/** Full-screen message with actions, used for loading, blocked cars, spawn limits and WebGL problems. */
export function StatusPanel({ title, children, actions, busy = false }: { title: string, children?: ReactNode, actions?: ReactNode, busy?: boolean }) {
  return (
    <div className="br-screen" data-testid="drive-status">
      <ScreenHeader title={title} />
      <div className="br-layer dr-status">
        {busy && <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />}
        <div className="br-panel dr-status-card">
          {children}
          {actions && <div className="dr-status-actions">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void, label?: string }) {
  return (
    <button type="button" className="btn br-btn" onClick={onClick}>
      <Icon name="back" />
      {' '}
      {label}
    </button>
  )
}

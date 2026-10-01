import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export interface Toast {
  id: number
  message: string
  tone?: 'info' | 'success' | 'error'
}

interface ToastContextValue {
  push: (message: string, tone?: Toast['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(current => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast toast-top toast-end z-50" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`alert ${toast.tone === 'error' ? 'alert-error' : toast.tone === 'success' ? 'alert-success' : 'alert-info'}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context)
    throw new Error('useToast must be used within ToastProvider')

  return context
}

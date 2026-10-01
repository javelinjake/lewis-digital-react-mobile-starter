import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { isNativeBuildTarget } from './build-target'

interface ServiceWorkerState {
  needRefresh: boolean
  offlineReady: boolean
  update: () => Promise<void>
}

const idle: ServiceWorkerState = {
  needRefresh: false,
  offlineReady: false,
  update: async () => {},
}

export function useServiceWorker(options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && !isNativeBuildTarget()
  const [state, setState] = useState<ServiceWorkerState>(idle)

  useEffect(() => {
    if (!enabled)
      return

    let cancelled = false
    let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {}

    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled)
        return

      updateServiceWorker = registerSW({
        immediate: false,
        onNeedRefresh() {
          setState(current => ({ ...current, needRefresh: true }))
        },
        onOfflineReady() {
          setState(current => ({ ...current, offlineReady: true }))
        },
      })

      setState(current => ({
        ...current,
        update: async () => {
          await updateServiceWorker(true)
        },
      }))
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const [prompt, setPrompt] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (isNativeBuildTarget())
      return

    function onPrompt(event: Event) {
      event.preventDefault()
      const deferred = event as Event & { prompt: () => Promise<void> }
      setPrompt(() => () => deferred.prompt())
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  return { canInstall, promptInstall: prompt }
}

export function ReloadPrompt({
  needRefresh,
  blocked,
  blockedReason,
  onUpdate,
  onDismiss,
}: {
  needRefresh: boolean
  blocked: boolean
  blockedReason?: string
  onUpdate: () => void
  onDismiss: () => void
}) {
  if (!needRefresh)
    return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-box bg-base-100 p-4 shadow-lg" role="status" style={{ marginBottom: 'var(--safe-bottom)' }}>
      <p className="font-medium">Update ready</p>
      <p className="mt-1 text-sm opacity-70">
        {blocked ? (blockedReason ?? 'Finish pending work before reloading.') : 'Reload to use the latest version.'}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>Later</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onUpdate} disabled={blocked}>Reload</button>
      </div>
    </div>
  )
}

export function InstallBanner({ canInstall, onInstall }: { canInstall: boolean, onInstall: () => void }) {
  if (!canInstall || isNativeBuildTarget())
    return null

  return (
    <div className="mt-4 rounded-box bg-base-100 p-4">
      <p className="font-medium">Install this app</p>
      <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onInstall}>Add to home screen</button>
    </div>
  )
}

export function PwaHost({ children }: { children?: ReactNode }) {
  return children ?? null
}

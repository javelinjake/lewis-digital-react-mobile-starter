import { useFormDirty } from '@ld/forms'
import { hideSplashScreen, isNativePlatform, setStatusBarAppearance } from '@ld/native'
import { useAppState, useBackButton, useDeepLinks } from '@ld/native/react'
import { ReloadPrompt, useServiceWorker } from '@ld/pwa'
import { ToastProvider } from '@ld/ui'
import { useEffect, useState } from 'react'
import { RouterProvider, useNavigate } from 'react-router'
import { SessionScope } from '@/app/session-scope'
import { useOutbox } from '@/app/use-outbox'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useTheme } from '@/hooks/use-theme'
import { router } from '@/routes/router'
import { useAuthStore } from '@/stores/auth.store'

export function App() {
  const status = useAuthStore(state => state.status)

  useEffect(() => {
    void useAuthStore.getState().bootstrap()
  }, [])

  useEffect(() => {
    if (status !== 'bootstrapping')
      void hideSplashScreen()
  }, [status])

  return (
    <ToastProvider>
      <SessionScope>
        <RouterProvider router={router} />
      </SessionScope>
    </ToastProvider>
  )
}

export function NativeRuntime() {
  const navigate = useNavigate()
  const { onResume } = useAppState()
  const outbox = useOutbox()
  const { theme } = useTheme()

  useDeepLinks(path => navigate(path))
  useBackButton({ onBack: () => navigate(-1) })

  useEffect(() => onResume(() => {
    void outbox?.flush()
  }), [onResume, outbox])

  useEffect(() => {
    void setStatusBarAppearance({
      light: theme === 'dracula',
      backgroundColor: theme === 'dracula' ? '#111827' : '#ffffff',
    })
  }, [theme])

  return null
}

export function UpdatePrompt() {
  const nativeShell = isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native'
  const sw = useServiceWorker({ enabled: !nativeShell })
  const dirty = useFormDirty()
  const { pendingCount } = useConnectivity()
  const [dismissed, setDismissed] = useState(false)
  const blocked = dirty || pendingCount > 0

  return (
    <ReloadPrompt
      needRefresh={sw.needRefresh && !dismissed}
      blocked={blocked}
      blockedReason={pendingCount > 0 ? 'Notes are still waiting to sync.' : 'Finish editing before reloading.'}
      onUpdate={() => {
        if (!blocked)
          void sw.update()
      }}
      onDismiss={() => setDismissed(true)}
    />
  )
}

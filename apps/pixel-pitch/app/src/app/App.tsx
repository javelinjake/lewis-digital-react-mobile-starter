import { useFormDirty } from '@ld/forms'
import { hideSplashScreen, isNativePlatform, setStatusBarAppearance } from '@ld/native'
import { useAppState, useBackButton, useDeepLinks } from '@ld/native/react'
import { ReloadPrompt, useServiceWorker } from '@ld/pwa'
import { ToastProvider } from '@ld/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { RouterProvider, useNavigate } from 'react-router'
import { SessionScope } from '@/app/session-scope'
import { gameKeys } from '@/features/game/queries/game.keys'
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
  const client = useQueryClient()

  useDeepLinks(path => navigate(path))
  useBackButton({ onBack: () => navigate(-1) })

  // Opening or coming back to the app is when the most has happened: catch the club up straight away, even when the
  // cached club is only seconds old.
  useEffect(() => {
    void client.invalidateQueries({ queryKey: gameKeys.all })
  }, [client])
  useEffect(() => onResume(() => {
    void client.invalidateQueries({ queryKey: gameKeys.all })
  }), [onResume, client])

  useEffect(() => {
    void setStatusBarAppearance({ light: true, backgroundColor: '#1b1f3b' })
  }, [])

  return null
}

export function UpdatePrompt() {
  const nativeShell = isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native'
  const sw = useServiceWorker({ enabled: !nativeShell })
  const dirty = useFormDirty()
  const [dismissed, setDismissed] = useState(false)
  const blocked = dirty

  return (
    <ReloadPrompt
      needRefresh={sw.needRefresh && !dismissed}
      blocked={blocked}
      blockedReason="Finish editing before reloading."
      onUpdate={() => {
        if (!blocked)
          void sw.update()
      }}
      onDismiss={() => setDismissed(true)}
    />
  )
}

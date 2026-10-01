import { hideSplashScreen, setStatusBarAppearance } from '@ld/native'
import { useAppState, useBackButton, useDeepLinks } from '@ld/native/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider, useNavigate } from 'react-router'
import { router } from '@/routes/router'
import { useAuthStore } from '@/stores/auth.store'
import { appMeta } from '../../app.meta'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export function App() {
  const status = useAuthStore(state => state.status)

  useEffect(() => {
    void useAuthStore.getState().bootstrap()
  }, [])

  useEffect(() => {
    if (status !== 'bootstrapping')
      void hideSplashScreen()
  }, [status])

  if (status === 'bootstrapping') {
    return <p className="grid min-h-dvh place-items-center font-bold text-brand-navy">Restoring session...</p>
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export function NativeRuntime() {
  const navigate = useNavigate()
  const { onResume } = useAppState()
  const refreshUser = useAuthStore(state => state.refreshUser)

  useDeepLinks(path => navigate(path))
  useBackButton({ onBack: () => navigate(-1) })

  useEffect(() => onResume(() => {
    void refreshUser().catch(() => {})
  }), [onResume, refreshUser])

  useEffect(() => {
    void setStatusBarAppearance({
      light: false,
      backgroundColor: appMeta.themeColor,
    })
  }, [])

  return null
}

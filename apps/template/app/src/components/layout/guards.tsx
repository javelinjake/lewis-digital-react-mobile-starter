import { Navigate, Outlet, useLocation } from 'react-router'
import { appConfig } from '@/config/app.config'
import { useAuthStore } from '@/stores/auth.store'

export function RequireAuth() {
  const status = useAuthStore(state => state.status)
  const location = useLocation()

  if (status !== 'authenticated')
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />

  return <Outlet />
}

/** Sign-in screens. A guest may still open them, to create an account or sign in and keep what they made. */
export function GuestOnly() {
  const status = useAuthStore(state => state.status)
  const isGuest = useAuthStore(state => state.user?.isAnonymous === true)

  if (status === 'authenticated' && !isGuest)
    return <Navigate to={appConfig.defaultRoute} replace />

  return <Outlet />
}

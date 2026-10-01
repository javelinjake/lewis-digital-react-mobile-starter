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

export function GuestOnly() {
  const status = useAuthStore(state => state.status)

  if (status === 'authenticated')
    return <Navigate to={appConfig.defaultRoute} replace />

  return <Outlet />
}

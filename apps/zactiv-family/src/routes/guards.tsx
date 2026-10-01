import { Navigate, Outlet, useLocation } from 'react-router'
import { hasCompletedOnboarding } from '@/lib/family-data'
import { useAuthStore } from '@/stores/auth.store'

export function RequireAuth() {
  const status = useAuthStore(state => state.status)
  const location = useLocation()

  if (status !== 'authenticated')
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />

  const watchingVideo = location.pathname.startsWith('/videos/')
  if (!hasCompletedOnboarding() && location.pathname !== '/welcome' && !watchingVideo)
    return <Navigate to="/welcome" replace />

  return <Outlet />
}

export function GuestOnly() {
  const status = useAuthStore(state => state.status)
  if (status === 'authenticated')
    return <Navigate to={hasCompletedOnboarding() ? '/' : '/welcome'} replace />

  return <Outlet />
}

export function redirectAfterAuth(path: string) {
  if (!hasCompletedOnboarding() && !path.startsWith('/videos/'))
    return '/welcome'
  return path
}

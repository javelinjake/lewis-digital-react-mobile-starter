import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { appConfig } from '@/config/app.config'
import { authMethods } from '@/config/auth.config'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'

/**
 * The game screens. Nobody has to sign in to play: with no session, this device gets its own account at once (a
 * Better Auth guest) and the player goes straight to founding a club. Signing in to the cloud is offered later, in
 * Settings, for playing on more than one device.
 */
export function RequireAuth() {
  const status = useAuthStore(state => state.status)
  const location = useLocation()

  if (status === 'authenticated')
    return <Outlet />
  if (authMethods.anonymous)
    return <StartOnThisDevice />
  return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
}

/** One device account at a time, even when React runs the effect twice (development) or the screen remounts. */
let starting: Promise<void> | null = null
function startOnce(loginAsGuest: () => Promise<void>) {
  starting ??= loginAsGuest().finally(() => {
    starting = null
  })
  return starting
}

function StartOnThisDevice() {
  const loginAsGuest = useAuthStore(state => state.loginAsGuest)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    startOnce(loginAsGuest).catch((reason) => {
      if (!cancelled)
        setError(formatError(reason))
    })
    return () => {
      cancelled = true
    }
  }, [loginAsGuest, attempt])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200 p-6 text-center">
      <h1 className="text-sm text-primary">PIXEL PITCH</h1>
      {error
        ? (
            <>
              <p role="alert" className="text-sm">
                Could not reach the league. Check your connection and try again.
                <span className="mt-1 block text-xs text-muted">{error}</span>
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setError(null)
                  setAttempt(value => value + 1)
                }}
              >
                Try again
              </button>
              <Link className="link text-sm" to="/login">Sign in to the cloud</Link>
            </>
          )
        : <p role="status" className="text-sm text-muted">Opening the stadium…</p>}
    </main>
  )
}

/** Sign-in screens. A player on this device only may still open them, to sign in to the cloud. */
export function GuestOnly() {
  const status = useAuthStore(state => state.status)
  const isGuest = useAuthStore(state => state.user?.isAnonymous === true)

  if (status === 'authenticated' && !isGuest)
    return <Navigate to={appConfig.defaultRoute} replace />

  return <Outlet />
}

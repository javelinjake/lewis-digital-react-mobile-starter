import type { ReactNode } from 'react'
import type { IconName } from '@/components/ui'
import { isNativePlatform } from '@ld/native'
import { useServiceWorker } from '@ld/pwa'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import logo from '@/assets/logo.svg'
import { Icon, PrimaryButton } from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'

export interface RouteHandle {
  title?: string
  requiresAuth?: boolean
  guestOnly?: boolean
  showTabs?: boolean
}

const tabs: Array<{ to: string, label: string, icon: IconName }> = [
  { to: '/', label: 'Home', icon: 'house' },
  { to: '/workouts', label: 'Workouts', icon: 'barbell' },
  { to: '/recipes', label: 'Recipes', icon: 'fork-knife' },
  { to: '/videos', label: 'Videos', icon: 'play-circle' },
  { to: '/journal', label: 'Journal', icon: 'chat-circle' },
]

function currentHandle(matches: ReturnType<typeof useMatches>) {
  return [...matches].reverse().find(match => match.handle)?.handle as RouteHandle | undefined
}

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const matches = useMatches()
  const handle = currentHandle(matches)
  const user = useAuthStore(state => state.user)
  const status = useAuthStore(state => state.status)
  const showBack = status === 'authenticated' && !handle?.showTabs && !handle?.guestOnly
  const onFamily = location.pathname === '/family'

  if (handle?.guestOnly)
    return null

  return (
    <header className="sticky top-0 z-20 bg-brand-blue text-white">
      <div className="mx-auto flex h-16 w-full max-w-lg items-center gap-3 px-4">
        {showBack
          ? (
              <button type="button" aria-label="Back" className="grid size-9 place-items-center text-2xl" onClick={() => navigate(-1)}>
                <Icon name="caret-left" />
              </button>
            )
          : null}
        <Link to="/" className="shrink-0" aria-label="Back to home">
          <img src={logo} alt="Zactiv Family" className="h-8 w-auto" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="rounded-full bg-brand-yellow px-3 py-1 text-sm font-bold text-brand-navy"
            aria-label="Back to home"
          >
            Z
            {' '}
            {user?.balance ?? 0}
          </Link>
          <button
            type="button"
            aria-label={onFamily ? 'Settings' : 'Your family'}
            className="grid size-9 place-items-center rounded-full bg-white/15 text-lg"
            onClick={() => navigate(onFamily ? '/settings' : '/family')}
          >
            <Icon name={onFamily ? 'gear' : 'user'} />
          </button>
        </div>
      </div>
    </header>
  )
}

export function TabBar() {
  const matches = useMatches()
  if (!currentHandle(matches)?.showTabs)
    return null

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-line bg-brand-cream">
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(tab => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${isActive ? 'text-brand-blue' : 'text-brand-navy/70'}`}
            >
              <Icon name={tab.icon} className="text-xl" />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppShell({ children }: { children?: ReactNode }) {
  const nativeShell = isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native'
  const worker = useServiceWorker({ enabled: !nativeShell })

  return (
    <div className="min-h-dvh bg-brand-cream">
      <AppHeader />
      {worker.needRefresh
        ? (
            <div className="bg-brand-navy px-4 py-3 text-center text-sm text-white">
              <p className="mb-2">A new version is ready.</p>
              <PrimaryButton onClick={() => void worker.update()}>Reload</PrimaryButton>
            </div>
          )
        : null}
      {children ?? <Outlet />}
      <TabBar />
    </div>
  )
}

export function useDocumentTitle() {
  const matches = useMatches()
  const title = currentHandle(matches)?.title

  useEffect(() => {
    document.title = title ? `${title} · Zactiv Family` : 'Zactiv Family'
  }, [title])
}

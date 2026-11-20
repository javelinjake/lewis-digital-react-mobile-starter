import { AppBar, BottomTabBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { ThemeToggle } from '@ld/ui'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { tabItems } from '@/config/nav.config'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { useTheme } from '@/hooks/use-theme'
import { preloadTabScreens } from '@/routes/pages'

export function TabsLayout() {
  const title = useRouteTitle('Home')
  const { theme, toggleTheme } = useTheme()
  const { offline, pendingCount } = useConnectivity()

  // Fetch the other tab screens while the browser is idle, so switching tabs does not wait on the network.
  useEffect(() => preloadTabScreens(), [])

  return (
    <MobileShell
      footer={(
        <>
          <OfflineBanner offline={offline} pendingCount={pendingCount} />
          <BottomTabBar items={tabItems} />
        </>
      )}
    >
      <AppBar title={title} end={<ThemeToggle theme={theme} onToggle={toggleTheme} />} />
      <Outlet />
    </MobileShell>
  )
}

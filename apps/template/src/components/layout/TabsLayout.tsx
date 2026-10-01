import { AppBar, BottomTabBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { ThemeToggle } from '@ld/ui'
import { Outlet } from 'react-router'
import { tabItems } from '@/config/nav.config'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { useTheme } from '@/hooks/use-theme'

export function TabsLayout() {
  const title = useRouteTitle('Home')
  const { theme, toggleTheme } = useTheme()
  const { offline, pendingCount } = useConnectivity()

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

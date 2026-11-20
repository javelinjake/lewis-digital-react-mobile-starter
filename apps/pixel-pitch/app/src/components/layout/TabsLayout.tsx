import type { TabBarItem } from '@ld/mobile-ui'
import type { ReactNode } from 'react'
import { AppBar, BottomTabBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { isPlaytestBuild } from '@/lib/platform/mock-storage'
import { preloadTabScreens } from '@/routes/pages'

/** The screen around the tab screens: the header, the tab bar and the offline banner. The app says what the tabs are. */
export function TabsLayout({ items, end }: { items: TabBarItem[], end?: ReactNode }) {
  const title = useRouteTitle('Club')
  const { offline } = useConnectivity()

  // Fetch the other tab screens while the browser is idle, so switching tabs does not wait on the network.
  useEffect(() => preloadTabScreens(), [])

  return (
    <MobileShell
      column
      footer={(
        <>
          <OfflineBanner offline={offline && !isPlaytestBuild} pendingCount={0} />
          <BottomTabBar items={items} />
        </>
      )}
    >
      <AppBar title={title} end={end} />
      <Outlet />
    </MobileShell>
  )
}

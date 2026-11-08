import { AppBar, BottomTabBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { tabItems } from '@/config/nav.config'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { preloadTabScreens } from '@/routes/pages'

export function TabsLayout() {
  const title = useRouteTitle('Club')
  const { offline } = useConnectivity()

  // Fetch the other tab screens while the browser is idle, so switching tabs does not wait on the network.
  useEffect(() => preloadTabScreens(), [])

  return (
    <MobileShell
      footer={(
        <>
          <OfflineBanner offline={offline} pendingCount={0} />
          <BottomTabBar items={tabItems} />
        </>
      )}
    >
      <AppBar title={title} />
      <Outlet />
    </MobileShell>
  )
}

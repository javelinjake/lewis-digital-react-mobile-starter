import type { ReactNode } from 'react'
import type { IconTab } from './GameChrome'
import { MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useConnectivity } from '@/hooks/use-connectivity'
import { isPlaytestBuild } from '@/lib/platform/mock-storage'
import { preloadTabScreens } from '@/routes/pages'
import { IconTabBar } from './GameChrome'

/** The screen around the tab screens: the header, the tab bar and the offline banner. The app says what goes in them. */
export function TabsLayout({ items, header }: { items: IconTab[], header: ReactNode }) {
  const { offline } = useConnectivity()

  // Fetch the other tab screens while the browser is idle, so switching tabs does not wait on the network.
  useEffect(() => preloadTabScreens(), [])

  return (
    <MobileShell
      column
      footer={(
        <>
          <OfflineBanner offline={offline && !isPlaytestBuild} pendingCount={0} />
          <IconTabBar items={items} />
        </>
      )}
    >
      {header}
      <Outlet />
    </MobileShell>
  )
}

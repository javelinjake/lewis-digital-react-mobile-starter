import { AppBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { Outlet, useNavigate } from 'react-router'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { isPlaytestBuild } from '@/lib/platform/mock-storage'

export function StackLayout() {
  const title = useRouteTitle('Back')
  const navigate = useNavigate()
  const { offline } = useConnectivity()

  return (
    <MobileShell column footer={<OfflineBanner offline={offline && !isPlaytestBuild} pendingCount={0} />}>
      <AppBar title={title} onBack={() => navigate(-1)} />
      <Outlet />
    </MobileShell>
  )
}

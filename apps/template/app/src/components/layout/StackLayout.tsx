import { AppBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { Outlet, useNavigate } from 'react-router'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'

export function StackLayout() {
  const title = useRouteTitle('Back')
  const navigate = useNavigate()
  const { offline, pendingCount } = useConnectivity()

  return (
    <MobileShell footer={<OfflineBanner offline={offline} pendingCount={pendingCount} />}>
      <AppBar title={title} onBack={() => navigate(-1)} />
      <Outlet />
    </MobileShell>
  )
}

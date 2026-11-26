import { AppBar, MobileShell, OfflineBanner } from '@ld/mobile-ui'
import { Outlet, useMatches, useNavigate } from 'react-router'
import { useConnectivity } from '@/hooks/use-connectivity'
import { useRouteTitle } from '@/hooks/use-route-title'
import { isPlaytestBuild } from '@/lib/platform/mock-storage'

export function StackLayout() {
  const title = useRouteTitle('Back')
  const navigate = useNavigate()
  const { offline } = useConnectivity()
  // A route can name where its back button goes (an arcade game goes back to the arcade, not to the last screen).
  const backTo = useMatches().map(match => (match.handle as { backTo?: string } | undefined)?.backTo).findLast(Boolean)

  return (
    <MobileShell column footer={<OfflineBanner offline={offline && !isPlaytestBuild} pendingCount={0} />}>
      <AppBar title={title} onBack={() => (backTo ? navigate(backTo, { replace: true }) : navigate(-1))} />
      <Outlet />
    </MobileShell>
  )
}

import { ListGroup, ListItem } from '@ld/mobile-ui'
import { getPlatform, impact, isNativePlatform, share } from '@ld/native'
import { InstallBanner, useInstallPrompt } from '@ld/pwa'
import { useToast } from '@ld/ui'
import { useAuthStore } from '@/stores/auth.store'

export function HomeOverview() {
  const user = useAuthStore(state => state.user)
  const toast = useToast()
  const install = useInstallPrompt()

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">
        Hello
        {user?.first_name ? `, ${user.first_name}` : ''}
      </h2>
      <ListGroup label="Device">
        <ListItem title="Platform" subtitle={isNativePlatform() ? getPlatform() : 'Web'} />
        <ListItem
          title="Share"
          subtitle="Send a link"
          onClick={() => {
            void impact('light')
            void share({ title: 'Lewis Digital', text: 'Hello from the starter app', url: window.location.origin }).then((result) => {
              if (result === 'unavailable')
                toast.push('Sharing is not available here', 'info')
            })
          }}
        />
      </ListGroup>
      <InstallBanner
        canInstall={install.canInstall}
        onInstall={() => {
          void install.promptInstall?.()
        }}
      />
    </div>
  )
}

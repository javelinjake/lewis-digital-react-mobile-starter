import { ActionSheet, ListGroup, ListItem } from '@ld/mobile-ui'
import { getPlatform } from '@ld/native'
import { usePushNotifications } from '@ld/native/react'
import { ConfirmDialog, useToast } from '@ld/ui'
import { useState } from 'react'
import { useOutbox } from '@/app/use-outbox'
import { useTheme } from '@/hooks/use-theme'
import { useAuthStore } from '@/stores/auth.store'

export function SettingsOverview() {
  const { theme, toggleTheme } = useTheme()
  const logout = useAuthStore(state => state.logout)
  const outbox = useOutbox()
  const toast = useToast()
  const push = usePushNotifications()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <ListGroup label="Settings">
        <ListItem title="Appearance" subtitle={theme === 'dracula' ? 'Dark' : 'Light'} onClick={toggleTheme} />
        <ListItem title="Platform" subtitle={getPlatform()} />
        <ListItem
          title="Notifications"
          subtitle={push.permission}
          onClick={() => {
            void push.register().then((permission) => {
              toast.push(permission === 'granted' ? 'Notifications enabled' : `Notifications ${permission}`, 'info')
            })
          }}
        />
        <ListItem title="Sync now" onClick={() => { void outbox?.flush().then(() => toast.push('Sync finished', 'success')) }} />
        <ListItem title="Account" subtitle="Sign out or discard pending writes" onClick={() => setSheetOpen(true)} />
      </ListGroup>
      <ActionSheet
        open={sheetOpen}
        title="Account"
        onClose={() => setSheetOpen(false)}
        actions={[
          { label: 'Sign out', onSelect: () => { void logout() } },
          { label: 'Discard pending writes', destructive: true, onSelect: () => setDiscardOpen(true) },
        ]}
      />
      <ConfirmDialog
        open={discardOpen}
        title="Discard pending writes?"
        body="Notes saved on this device for this account will be deleted. This does not affect other accounts."
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          void outbox?.clear().then(() => {
            toast.push('Pending writes discarded', 'info')
            setDiscardOpen(false)
          })
        }}
      />
    </div>
  )
}

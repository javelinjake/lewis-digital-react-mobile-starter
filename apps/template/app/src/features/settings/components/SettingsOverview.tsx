import { ActionSheet, ListGroup, ListItem } from '@ld/mobile-ui'
import { getPlatform } from '@ld/native'
import { usePushNotifications } from '@ld/native/react'
import { ConfirmDialog, useToast } from '@ld/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { clearUserData } from '@/app/session-data'
import { useOutbox } from '@/app/use-outbox'
import { useTheme } from '@/hooks/use-theme'
import { authApi } from '@/lib/auth/auth-api'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'
import { saveJson } from '../lib/save-json'

export function SettingsOverview() {
  const { theme, toggleTheme } = useTheme()
  const logout = useAuthStore(state => state.logout)
  const deleteAccount = useAuthStore(state => state.deleteAccount)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const outbox = useOutbox()
  const toast = useToast()
  const push = usePushNotifications()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
        {user?.isAnonymous
          ? <ListItem title="Create an account" subtitle="Keep your progress on every device" onClick={() => navigate('/register?link=1')} />
          : null}
        <ListItem title="Account" subtitle={user?.isAnonymous ? 'Guest' : (user?.email ?? 'Sign out, export or delete')} onClick={() => setSheetOpen(true)} />
      </ListGroup>
      <ActionSheet
        open={sheetOpen}
        title="Account"
        onClose={() => setSheetOpen(false)}
        actions={[
          { label: 'Sign out', onSelect: () => { void logout() } },
          {
            label: 'Export my data',
            onSelect: () => {
              void authApi.exportAccount().then(data => saveJson('my-data.json', data)).catch(reason => toast.push(formatError(reason), 'error'))
            },
          },
          { label: 'Discard pending writes', destructive: true, onSelect: () => setDiscardOpen(true) },
          { label: 'Delete my account', destructive: true, onSelect: () => setDeleteOpen(true) },
        ]}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        body="Your account and everything in it is deleted from our servers and from this device. This cannot be undone."
        confirmLabel="Delete account"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const userId = user?.id
          void deleteAccount()
            .then(async () => {
              if (userId)
                await clearUserData(userId)
              setDeleteOpen(false)
              navigate('/login')
            })
            .catch((reason) => {
              toast.push(formatError(reason), 'error')
              setDeleteOpen(false)
            })
        }}
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

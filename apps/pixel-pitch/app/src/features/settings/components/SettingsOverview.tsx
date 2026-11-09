import { ActionSheet, ListGroup, ListItem } from '@ld/mobile-ui'
import { getPlatform, isNativePlatform } from '@ld/native'
import { usePushNotifications } from '@ld/native/react'
import { ConfirmDialog, useToast } from '@ld/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { clearUserData } from '@/app/session-data'
import { NOTIFICATION_TYPES, useNotificationSettings } from '@/hooks/use-notification-settings'
import { useReplayMode } from '@/hooks/use-replay-mode'
import { authApi } from '@/lib/auth/auth-api'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'
import { saveJson } from '../lib/save-json'

export function SettingsOverview() {
  const logout = useAuthStore(state => state.logout)
  const deleteAccount = useAuthStore(state => state.deleteAccount)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const toast = useToast()
  const [replayMode, setReplayMode] = useReplayMode()
  const [alerts, setAlert] = useNotificationSettings()
  const push = usePushNotifications()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <ListGroup label="Settings">
        <ListItem
          title="Match view"
          subtitle={replayMode === 'text' ? 'Written report' : 'Pixel pitch'}
          onClick={() => setReplayMode(replayMode === 'text' ? 'pitch' : 'text')}
        />
        <ListItem title="Platform" subtitle={getPlatform()} />
        {NOTIFICATION_TYPES.map(entry => (
          <ListItem
            key={entry.type}
            title={`Alert: ${entry.label}`}
            subtitle={alerts.includes(entry.type) ? 'On' : 'Off'}
            onClick={() => {
              const on = !alerts.includes(entry.type)
              setAlert(entry.type, on)
              // The first time one is turned on, ask the phone for permission to show alerts.
              if (on && isNativePlatform())
                void import('@ld/native/notifications').then(({ requestNotificationPermission }) => requestNotificationPermission())
            }}
          />
        ))}
        <ListItem
          title="Notifications"
          subtitle={push.permission}
          onClick={() => {
            void push.register().then((permission) => {
              toast.push(permission === 'granted' ? 'Notifications enabled' : `Notifications ${permission}`, 'info')
            })
          }}
        />
        {user?.isAnonymous
          ? null
          : <ListItem title="Account" subtitle={user?.email ?? 'Sign out, export or delete'} onClick={() => setSheetOpen(true)} />}
      </ListGroup>
      {user?.isAnonymous
        ? (
            <ListGroup label="Cloud save">
              <ListItem title="Save to the cloud" subtitle="Keep your club safe and play on any device" onClick={() => navigate('/register?link=1')} />
              <ListItem title="Sign in to the cloud" subtitle="Already have a cloud club? Play it here" onClick={() => navigate('/login?redirect=/club')} />
              <ListItem title="This device" subtitle="Export or delete" onClick={() => setSheetOpen(true)} />
            </ListGroup>
          )
        : null}
      <ActionSheet
        open={sheetOpen}
        title={user?.isAnonymous ? 'This device' : 'Account'}
        onClose={() => setSheetOpen(false)}
        actions={[
          ...(user?.isAnonymous ? [] : [{ label: 'Sign out', onSelect: () => { void logout() } }]),
          {
            label: 'Export my data',
            onSelect: () => {
              void authApi.exportAccount().then(data => saveJson('my-data.json', data)).catch(reason => toast.push(formatError(reason), 'error'))
            },
          },
          { label: user?.isAnonymous ? 'Delete my club' : 'Delete my account', destructive: true, onSelect: () => setDeleteOpen(true) },
        ]}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={user?.isAnonymous ? 'Delete your club?' : 'Delete your account?'}
        body={user?.isAnonymous ? 'Your club is deleted from this device and our servers. This cannot be undone.' : 'Your account and everything in it is deleted from our servers and from this device. This cannot be undone.'}
        confirmLabel={user?.isAnonymous ? 'Delete club' : 'Delete account'}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const userId = user?.id
          void deleteAccount()
            .then(async () => {
              if (userId)
                await clearUserData(userId)
              setDeleteOpen(false)
              navigate('/')
            })
            .catch((reason) => {
              toast.push(formatError(reason), 'error')
              setDeleteOpen(false)
            })
        }}
      />
    </div>
  )
}

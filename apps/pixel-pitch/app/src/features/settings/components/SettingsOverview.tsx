import { ActionSheet } from '@ld/mobile-ui'
import { getPlatform, isNativePlatform } from '@ld/native'
import { ConfirmDialog, useToast } from '@ld/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { clearUserData } from '@/app/session-data'
import { NOTIFICATION_TYPES, useNotificationSettings } from '@/hooks/use-notification-settings'
import { useSoundSetting } from '@/hooks/use-sound-setting'
import { authApi } from '@/lib/auth/auth-api'
import { isPlaytestBuild } from '@/lib/platform/mock-storage'
import { analyticsAvailable, crashReportsAvailable, crashReportsOn, setAnalyticsConsent, setCrashReports, telemetry } from '@/lib/telemetry/telemetry'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'
import { saveJson } from '../lib/save-json'
import { PlaytestTools } from './PlaytestTools'
import { SettingsGroup, SettingsRow, SettingsSwitch } from './SettingsRows'

export function SettingsOverview() {
  const logout = useAuthStore(state => state.logout)
  const deleteAccount = useAuthStore(state => state.deleteAccount)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const toast = useToast()
  const [alerts, setAlert] = useNotificationSettings()
  const [sound, setSound] = useSoundSetting()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [sharing, setSharing] = useState(() => telemetry.consent.analytics)
  const [crashReports, setCrashReportsState] = useState(crashReportsOn)
  return (
    <div className="flex flex-col gap-5">
      <SettingsGroup label="Sound">
        <SettingsSwitch title="Sound effects" subtitle="Packs, matches, the arcade and buttons" on={sound} onChange={setSound} />
      </SettingsGroup>

      <SettingsGroup label="Game">
        <SettingsRow title="Shop" subtitle="League Pass, gems, kits and restore purchases" onClick={() => navigate('/shop?from=settings')} />
        {crashReportsAvailable
          ? (
              <SettingsSwitch
                title="Send crash reports"
                on={crashReports}
                onChange={(next) => {
                  setCrashReportsState(next)
                  void setCrashReports(next)
                }}
              />
            )
          : null}
        {analyticsAvailable
          ? (
              <SettingsSwitch
                title="Share usage data"
                subtitle="Helps improve the game. Nothing that identifies you"
                on={sharing}
                onChange={(next) => {
                  setSharing(next)
                  void setAnalyticsConsent(next)
                }}
              />
            )
          : null}
      </SettingsGroup>

      <SettingsGroup label="Notifications">
        {NOTIFICATION_TYPES.map(entry => (
          <SettingsSwitch
            key={entry.type}
            title={entry.label}
            on={alerts.includes(entry.type)}
            onChange={(on) => {
              setAlert(entry.type, on)
              // The first time one is turned on, ask the phone for permission to show alerts.
              if (on && isNativePlatform())
                void import('@ld/native/notifications').then(({ requestNotificationPermission }) => requestNotificationPermission())
            }}
          />
        ))}
      </SettingsGroup>

      {/* A playtest build is offline, with no server to save to. */}
      {user?.isAnonymous && !isPlaytestBuild
        ? (
            <SettingsGroup label="Cloud save">
              <SettingsRow title="Save to the cloud" subtitle="Keep your club safe and play on any device" onClick={() => navigate('/register?link=1')} />
              <SettingsRow title="Sign in to the cloud" subtitle="Already have a cloud club? Play it here" onClick={() => navigate('/login?redirect=/club')} />
              <SettingsRow title="This device" subtitle="Export or delete" onClick={() => setSheetOpen(true)} />
            </SettingsGroup>
          )
        : null}
      {user?.isAnonymous
        ? null
        : (
            <SettingsGroup label="Account">
              <SettingsRow title="Account" subtitle={user?.email ?? 'Sign out, export or delete'} onClick={() => setSheetOpen(true)} />
            </SettingsGroup>
          )}

      <SettingsGroup label="About">
        <SettingsRow title="Platform" subtitle={getPlatform()} />
      </SettingsGroup>

      {isPlaytestBuild ? <PlaytestTools /> : null}
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

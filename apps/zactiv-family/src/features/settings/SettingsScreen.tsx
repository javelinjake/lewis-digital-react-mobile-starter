import { useNavigate } from 'react-router'
import { OutlineButton } from '@/components/ui'
import { useFamilyState } from '@/lib/use-family-state'
import { useAuthStore } from '@/stores/auth.store'

export function SettingsScreen() {
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const updateProfile = useAuthStore(state => state.updateProfile)
  const navigate = useNavigate()
  const { state, update } = useFamilyState()

  function toggle(key: 'captions' | 'keepAwake' | 'reminders') {
    update(current => ({
      ...current,
      preferences: { ...current.preferences, [key]: !current.preferences[key] },
    }))
  }

  return (
    <main className="screen screen-stack">
      <h1 className="mb-4 text-4xl font-bold">Settings</h1>
      <section className="mb-4 rounded-3xl bg-brand-card p-4">
        <h2 className="mb-3 font-bold">Account</h2>
        <label className="mb-3 block">
          <span className="text-sm">Your name</span>
          <input
            defaultValue={user?.firstName || ''}
            className="mt-1 w-full bg-transparent font-bold outline-none"
            onBlur={event => void updateProfile({ first_name: event.target.value })}
          />
        </label>
        <p>
          <span className="block text-sm">Email address</span>
          <span className="font-bold">{user?.email}</span>
        </p>
      </section>
      <section className="mb-4 rounded-3xl bg-brand-card p-4">
        <h2 className="mb-3 font-bold">Preferences</h2>
        <Preference label="Video captions" body="Show when available" on={state.preferences.captions} onToggle={() => toggle('captions')} />
        <Preference label="Keep screen awake" body="During workouts and cooking" on={state.preferences.keepAwake} onToggle={() => toggle('keepAwake')} />
        <Preference label="Reminders" body="Choose when to hear from us" on={state.preferences.reminders} onToggle={() => toggle('reminders')} />
      </section>
      <a href="mailto:support@zactiv.co.uk" className="mb-2 block rounded-2xl bg-brand-card px-4 py-3 font-bold">Help & support</a>
      <p className="mb-4 rounded-2xl bg-brand-card px-4 py-3">
        <span className="block font-bold">About Zactiv</span>
        <span className="text-sm">Move, cook, watch and chat as a family.</span>
      </p>
      <OutlineButton
        onClick={() => {
          void logout().then(() => navigate('/login'))
        }}
      >
        Log out
      </OutlineButton>
    </main>
  )
}

function Preference({ label, body, on, onToggle }: { label: string, body: string, on: boolean, onToggle: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span>
        <span className="block font-bold">{label}</span>
        <span className="text-sm opacity-70">{body}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} className={`h-7 w-12 rounded-full ${on ? 'bg-brand-blue' : 'bg-brand-line'}`}>
        <span className={`block size-5 rounded-full bg-white transition ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

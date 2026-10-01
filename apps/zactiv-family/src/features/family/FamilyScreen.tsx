import { Link } from 'react-router'
import { useFamilyState } from '@/lib/use-family-state'
import { useAuthStore } from '@/stores/auth.store'

export function FamilyScreen() {
  const user = useAuthStore(state => state.user)
  const { state, update } = useFamilyState()
  const familyName = state.familyName || user?.familyName || 'Your family'

  return (
    <main className="screen screen-stack">
      <h1 className="text-4xl font-bold">{familyName}</h1>
      <p className="mb-4">Your space to move, cook and chat together.</p>
      <label className="mb-4 block rounded-3xl bg-brand-card p-4">
        <span className="text-sm font-bold">Family name</span>
        <input
          defaultValue={familyName}
          className="mt-1 w-full bg-transparent text-lg font-bold outline-none"
          onBlur={event => update(current => ({ ...current, familyName: event.target.value }))}
        />
      </label>
      {state.members.length
        ? (
            <>
              <h2 className="mb-2 text-xl font-bold">Family members</h2>
              <ul className="mb-4 flex flex-col gap-2">
                {state.members.map(member => (
                  <li key={member.id} className="flex items-center gap-3 rounded-2xl bg-brand-card px-4 py-3">
                    <span className="grid size-10 place-items-center rounded-full bg-brand-yellow font-bold">{member.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <span className="block font-bold">{member.name}</span>
                      <span className="text-sm capitalize opacity-70">{member.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )
        : null}
      <Link to="/settings" className="block rounded-2xl bg-brand-card px-4 py-3 font-bold">
        Settings
      </Link>
    </main>
  )
}

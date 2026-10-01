import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import logo from '@/assets/logo.svg'
import { PrimaryButton, TextField } from '@/components/ui'
import { parseError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth.store'

export function RegisterScreen() {
  const register = useAuthStore(state => state.register)
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const school = params.get('school') || undefined

  return (
    <main className="screen">
      <img src={logo} alt="Zactiv Family" className="mb-8 h-12" />
      <h1 className="mb-2 text-3xl font-bold">Join the family</h1>
      <p className="mb-6 text-sm">We will email you a link to verify your account.</p>
      {done
        ? <p className="rounded-2xl bg-brand-card p-4 font-bold">Check your inbox, then open the verification link on this device.</p>
        : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                setError(null)
                void register(email, password, school)
                  .then(() => setDone(true))
                  .catch(reason => setError(parseError(reason).userMessage))
              }}
            >
              <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
              <TextField label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} />
              {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
              <PrimaryButton type="submit">Create account</PrimaryButton>
            </form>
          )}
      <p className="mt-6 text-sm">
        Already registered?
        {' '}
        <Link to="/login" className="font-bold text-brand-blue">Sign in</Link>
      </p>
    </main>
  )
}

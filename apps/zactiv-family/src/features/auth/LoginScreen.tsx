import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import logo from '@/assets/logo.svg'
import { PrimaryButton, TextField } from '@/components/ui'
import { parseError } from '@/lib/errors'
import { redirectAfterAuth } from '@/routes/guards'
import { useAuthStore } from '@/stores/auth.store'

export function LoginScreen() {
  const login = useAuthStore(state => state.login)
  const requestPassword = useAuthStore(state => state.requestPassword)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(params.get('error'))
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <main className="screen">
      <img src={logo} alt="Zactiv Family" className="mb-8 h-12" />
      <h1 className="mb-6 text-3xl font-bold">Sign in</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          void login(email, password)
            .then(() => navigate(redirectAfterAuth(params.get('redirect') || '/')))
            .catch(reason => setError(parseError(reason).userMessage))
        }}
      >
        <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
        <TextField label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} required />
        {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
        {notice ? <p className="text-sm">{notice}</p> : null}
        <PrimaryButton type="submit">Sign in</PrimaryButton>
      </form>
      <button
        type="button"
        className="mt-4 text-sm font-bold text-brand-blue"
        onClick={() => {
          if (!email) {
            setError('Enter your email first.')
            return
          }
          void requestPassword(email).then(() => setNotice('If that email exists, a reset link is on its way.')).catch(reason => setError(parseError(reason).userMessage))
        }}
      >
        Forgot password
      </button>
      <p className="mt-6 text-sm">
        New here?
        {' '}
        <Link to="/register" className="font-bold text-brand-blue">Create an account</Link>
      </p>
    </main>
  )
}

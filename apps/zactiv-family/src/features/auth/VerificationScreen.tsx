import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import logo from '@/assets/logo.svg'
import { PrimaryButton, TextField } from '@/components/ui'
import { parseError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth.store'

function readToken(params: URLSearchParams) {
  const query = params.get('token')
  if (query)
    return query

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return hash.get('token') || ''
}

export function VerificationScreen() {
  const verify = useAuthStore(state => state.verify)
  const updateProfile = useAuthStore(state => state.updateProfile)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = readToken(params)
  const [error, setError] = useState<string | null>(token ? null : 'Verification link is missing its token.')
  const [familyName, setFamilyName] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!token)
      return

    void verify(token)
      .then((loggedIn) => {
        setReady(true)
        if (!loggedIn)
          setError('Verified. Sign in with the email and password you registered.')
      })
      .catch(reason => setError(parseError(reason).userMessage))
  }, [token, verify])

  return (
    <main className="screen">
      <img src={logo} alt="Zactiv Family" className="mb-8 h-12" />
      <h1 className="mb-4 text-3xl font-bold">Verify your email</h1>
      {error ? <p className="mb-4 text-sm font-bold text-red-700">{error}</p> : null}
      {ready && user && !user.familyName
        ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void updateProfile({ family_name: familyName }).then(() => navigate('/welcome'))
              }}
            >
              <TextField label="Family name" value={familyName} onChange={event => setFamilyName(event.target.value)} required />
              <PrimaryButton type="submit">Continue</PrimaryButton>
            </form>
          )
        : null}
      {ready && user?.familyName
        ? <PrimaryButton onClick={() => navigate('/welcome')}>Continue</PrimaryButton>
        : null}
    </main>
  )
}

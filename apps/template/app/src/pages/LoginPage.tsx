import { EmailInput, FormActions, LdForm, PasswordInput, SubmitButton } from '@ld/forms'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authMethods } from '@/config/auth.config'
import { loginSchema } from '@/features/auth/forms/login.schema'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'

export function LoginPage() {
  const login = useAuthStore(state => state.login)
  const loginAsGuest = useAuthStore(state => state.loginAsGuest)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [guestPending, setGuestPending] = useState(false)
  const destination = params.get('redirect') || '/home'

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      {params.get('verified') ? <p role="status" className="mb-3 text-sm text-success">Email confirmed. Sign in to continue.</p> : null}
      {user?.isAnonymous ? <p className="mb-3 text-sm opacity-70">Sign in and what you made as a guest comes with you.</p> : null}
      {authMethods.emailPassword
        ? (
            <LdForm
              schema={loginSchema}
              defaultValues={{ email: '', password: '' }}
              onSubmit={async (values) => {
                setError(null)
                try {
                  await login(values.email, values.password)
                  navigate(destination)
                }
                catch (reason) {
                  setError(formatError(reason))
                }
              }}
            >
              {form => (
                <>
                  <EmailInput name="email" label="Email" control={form.control} />
                  <PasswordInput name="password" label="Password" control={form.control} />
                  {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
                  <FormActions>
                    <SubmitButton label="Sign in" pending={form.formState.isSubmitting} />
                  </FormActions>
                </>
              )}
            </LdForm>
          )
        : null}
      <div className="mt-4 flex flex-col items-start gap-2 text-sm">
        {authMethods.emailPassword
          ? (
              <>
                <Link className="link" to="/forgot-password">Forgot your password?</Link>
                <Link className="link" to="/register">Create an account</Link>
              </>
            )
          : null}
        {authMethods.anonymous && !user
          ? (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                disabled={guestPending}
                onClick={async () => {
                  setGuestPending(true)
                  setError(null)
                  try {
                    await loginAsGuest()
                    navigate(destination)
                  }
                  catch (reason) {
                    setError(formatError(reason))
                  }
                  finally {
                    setGuestPending(false)
                  }
                }}
              >
                Continue as guest
              </button>
            )
          : null}
      </div>
    </div>
  )
}

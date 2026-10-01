import { EmailInput, FormActions, LdForm, PasswordInput, SubmitButton } from '@ld/forms'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { loginSchema } from '@/features/auth/forms/login.schema'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'

export function LoginPage() {
  const login = useAuthStore(state => state.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <LdForm
        schema={loginSchema}
        defaultValues={{ email: '', password: '' }}
        onSubmit={async (values) => {
          setError(null)
          try {
            await login(values.email, values.password)
            navigate(params.get('redirect') || '/home')
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
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <FormActions>
              <SubmitButton label="Sign in" pending={form.formState.isSubmitting} />
            </FormActions>
          </>
        )}
      </LdForm>
    </div>
  )
}

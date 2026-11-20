import { EmailInput, FormActions, LdForm, PasswordInput, SubmitButton, TextInput } from '@ld/forms'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { registerWithEmail } from '@/features/auth/api/auth-actions'
import { registerSchema } from '@/features/auth/forms/login.schema'
import { useAuthStore } from '@/stores/auth.store'
import { formatError } from '@/utils/format-error'

export function RegisterPage() {
  const user = useAuthStore(state => state.user)
  const [params] = useSearchParams()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const linking = Boolean(user?.isAnonymous) || params.get('link') === '1'

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p role="status" className="text-sm">
          We sent a link to
          {' '}
          <strong>{sentTo}</strong>
          . Open it to confirm your address, then sign in.
          {linking ? ' Everything you made as a guest comes with you.' : ''}
        </p>
        <Link className="btn btn-primary" to="/login">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{linking ? 'Keep your progress' : 'Create an account'}</h1>
      {linking ? <p className="mb-3 text-sm opacity-70">Create an account and what you made as a guest stays with you, on every device.</p> : null}
      <LdForm
        schema={registerSchema}
        defaultValues={{ name: '', email: '', password: '' }}
        onSubmit={async (values) => {
          setError(null)
          try {
            await registerWithEmail(values)
            setSentTo(values.email)
          }
          catch (reason) {
            setError(formatError(reason))
          }
        }}
      >
        {form => (
          <>
            <TextInput name="name" label="Name" control={form.control} autoComplete="name" />
            <EmailInput name="email" label="Email" control={form.control} />
            <PasswordInput name="password" label="Password" control={form.control} autoComplete="new-password" />
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
            <FormActions>
              <SubmitButton label="Create account" pending={form.formState.isSubmitting} />
            </FormActions>
          </>
        )}
      </LdForm>
      <p className="mt-4 text-sm">
        Already have an account?
        {' '}
        <Link className="link" to="/login">Sign in</Link>
      </p>
    </div>
  )
}

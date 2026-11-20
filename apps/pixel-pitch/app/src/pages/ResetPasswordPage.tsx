import { FormActions, LdForm, PasswordInput, SubmitButton } from '@ld/forms'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { completePasswordReset } from '@/features/auth/api/auth-actions'
import { resetPasswordSchema } from '@/features/auth/forms/login.schema'
import { formatError } from '@/utils/format-error'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const token = params.get('token')

  if (!token || params.get('error')) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Link expired</h1>
        <p className="text-sm">This reset link is no longer valid. Ask for a new one.</p>
        <Link className="btn btn-primary" to="/forgot-password">Send a new link</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Choose a new password</h1>
      <LdForm
        schema={resetPasswordSchema}
        defaultValues={{ password: '' }}
        onSubmit={async (values) => {
          setError(null)
          try {
            await completePasswordReset(token, values.password)
            navigate('/login')
          }
          catch (reason) {
            setError(formatError(reason))
          }
        }}
      >
        {form => (
          <>
            <PasswordInput name="password" label="New password" control={form.control} autoComplete="new-password" />
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
            <FormActions>
              <SubmitButton label="Save password" pending={form.formState.isSubmitting} />
            </FormActions>
          </>
        )}
      </LdForm>
    </div>
  )
}

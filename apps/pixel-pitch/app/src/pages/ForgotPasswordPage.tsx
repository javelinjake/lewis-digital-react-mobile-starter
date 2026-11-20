import { EmailInput, FormActions, LdForm, SubmitButton } from '@ld/forms'
import { useState } from 'react'
import { Link } from 'react-router'
import { requestPasswordReset } from '@/features/auth/api/auth-actions'
import { forgotPasswordSchema } from '@/features/auth/forms/login.schema'
import { formatError } from '@/utils/format-error'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p role="status" className="text-sm">If there is an account for that address, we sent a link to choose a new password.</p>
        <Link className="btn btn-primary" to="/login">Back to sign in</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Reset your password</h1>
      <LdForm
        schema={forgotPasswordSchema}
        defaultValues={{ email: '' }}
        onSubmit={async (values) => {
          setError(null)
          try {
            await requestPasswordReset(values.email)
            setSent(true)
          }
          catch (reason) {
            setError(formatError(reason))
          }
        }}
      >
        {form => (
          <>
            <EmailInput name="email" label="Email" control={form.control} />
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
            <FormActions>
              <SubmitButton label="Send reset link" pending={form.formState.isSubmitting} />
            </FormActions>
          </>
        )}
      </LdForm>
      <p className="mt-4 text-sm"><Link className="link" to="/login">Back to sign in</Link></p>
    </div>
  )
}

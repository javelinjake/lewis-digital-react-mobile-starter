import { getFrontendOrigin } from '@/config/env.config'
import { authApi } from '@/lib/auth/auth-api'

/**
 * Email links open the app through a Universal or App Link, so they point at the public web origin. The sign-up
 * link confirms the address and lands on the sign-in screen. The reset link lands on the reset screen with a token.
 */
export function registerWithEmail(input: { name: string, email: string, password: string }) {
  return authApi.signUpWithEmail({ ...input, callbackURL: `${getFrontendOrigin()}/login?verified=1` })
}

export function requestPasswordReset(email: string) {
  return authApi.requestPasswordReset(email, `${getFrontendOrigin()}/reset-password`)
}

export function completePasswordReset(token: string, password: string) {
  return authApi.resetPassword(token, password)
}

import type { AuthApi } from './auth-api.types'
import { getApi } from '@/lib/api/client'

export const liveAuthApi: AuthApi = {
  getSession: () => getApi().auth.getSession(),
  signInAnonymously: () => getApi().auth.signInAnonymously(),
  signInWithEmail: (email, password) => getApi().auth.signInWithEmail(email, password),
  signUpWithEmail: input => getApi().auth.signUpWithEmail(input),
  requestPasswordReset: (email, redirectTo) => getApi().auth.requestPasswordReset(email, redirectTo),
  resetPassword: (token, newPassword) => getApi().auth.resetPassword(token, newPassword),
  signOut: () => getApi().auth.signOut(),
  deleteAccount: () => getApi().auth.deleteAccount(),
  exportAccount: () => getApi().auth.exportAccount(),
}

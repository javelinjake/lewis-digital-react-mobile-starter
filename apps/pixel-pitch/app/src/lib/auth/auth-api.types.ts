import type { SessionUser } from './session-user'

/** Everything the app needs from sign-in. `live` talks to the api app, `mock` is in memory. */
export interface AuthApi {
  /** The person signed in on this device, or null. */
  getSession: () => Promise<SessionUser | null>
  signInAnonymously: () => Promise<SessionUser>
  signInWithEmail: (email: string, password: string) => Promise<SessionUser>
  signUpWithEmail: (input: { email: string, password: string, name: string, callbackURL: string }) => Promise<{ needsVerification: boolean }>
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  exportAccount: () => Promise<unknown>
}

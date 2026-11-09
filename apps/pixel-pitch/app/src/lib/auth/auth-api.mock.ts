import type { AuthApi } from './auth-api.types'
import type { SessionUser } from './session-user'
import { ApiError } from '@ld/api-client'
import { sleep } from '@ld/utils/async/sleep'

/**
 * In-memory stand-in for the api app, so the template runs with nothing else started and tests are hermetic.
 * Any email signs in with any password. An address starting with "b" becomes Bee, everything else Ada.
 * The session survives a reload (sessionStorage), like a cookie would.
 */
const SESSION_KEY = 'ld-mock-session'

function readSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw)
      return JSON.parse(raw) as SessionUser

    // `?mock-user=ada` opens a signed-in screen directly. Lighthouse and screenshots cannot click through sign-in.
    const seed = new URLSearchParams(window.location.search).get('mock-user')
    if (seed) {
      const user = userFor(`${seed}@example.com`)
      writeSession(user)
      return user
    }
    return null
  }
  catch {
    return null
  }
}

function writeSession(user: SessionUser | null) {
  if (user)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else
    sessionStorage.removeItem(SESSION_KEY)
}

function userFor(email: string): SessionUser {
  const bee = email.toLowerCase().startsWith('b')
  return {
    id: bee ? 'user-b' : 'user-a',
    email,
    name: bee ? 'Bee' : 'Ada',
    image: null,
    role: 'member',
    isAnonymous: false,
    emailVerified: true,
  }
}

export const mockAuthApi: AuthApi = {
  async getSession() {
    await sleep(10)
    return readSession()
  },
  async signInAnonymously() {
    await sleep(10)
    const user: SessionUser = { id: 'guest', email: 'guest@guest.invalid', name: null, image: null, role: 'member', isAnonymous: true, emailVerified: false }
    writeSession(user)
    return user
  },
  async signInWithEmail(email, password) {
    await sleep(10)
    if (!password)
      throw new ApiError(401, 'Invalid email or password')
    const user = userFor(email)
    writeSession(user)
    return user
  },
  async signUpWithEmail() {
    await sleep(10)
    return { needsVerification: true }
  },
  async requestPasswordReset() {
    await sleep(10)
  },
  async resetPassword() {
    await sleep(10)
  },
  async signOut() {
    writeSession(null)
  },
  async deleteAccount() {
    writeSession(null)
  },
  async exportAccount() {
    return { exportedAt: new Date().toISOString(), account: readSession(), data: {} }
  },
}

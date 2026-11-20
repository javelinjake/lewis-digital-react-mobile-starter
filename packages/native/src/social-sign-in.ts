import { SocialLogin } from '@capgo/capacitor-social-login'
import { isIos, isNativePlatform } from './platform'

export interface SocialSignInConfig {
  /** Google's web client id. It must also be the `GOOGLE_CLIENT_ID` of the api, so the token's audience matches. */
  googleWebClientId?: string
  googleIosClientId?: string
  /** Turn on Sign in with Apple (iOS only here). */
  apple?: boolean
}

export interface IdTokenSignIn {
  provider: 'apple' | 'google'
  /** The identity token the api verifies (`auth.signInWithIdToken`). */
  token: string
}

let initialised = false

export async function initSocialSignIn(config: SocialSignInConfig) {
  if (!isNativePlatform() || initialised)
    return
  await SocialLogin.initialize({
    ...(config.apple && isIos() ? { apple: {} } : {}),
    ...(config.googleWebClientId ? { google: { webClientId: config.googleWebClientId, iOSClientId: config.googleIosClientId } } : {}),
  })
  initialised = true
}

/** Sign in with Apple is only offered on iOS here. Android would need a web redirect. */
export function isAppleSignInAvailable() {
  return isNativePlatform() && isIos()
}

export function isSocialSignInAvailable() {
  return isNativePlatform()
}

export async function signInWithApple(): Promise<IdTokenSignIn> {
  const { result } = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'] } })
  if (!result.idToken)
    throw new Error('Apple did not return an identity token.')
  return { provider: 'apple', token: result.idToken }
}

export async function signInWithGoogle(): Promise<IdTokenSignIn> {
  const { result } = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } })
  const token = 'idToken' in result ? result.idToken : null
  if (!token)
    throw new Error('Google did not return an identity token.')
  return { provider: 'google', token }
}

export async function signOutSocial() {
  if (!isNativePlatform() || !initialised)
    return
  await Promise.allSettled([SocialLogin.logout({ provider: 'apple' }), SocialLogin.logout({ provider: 'google' })])
}

import type { BetterAuthOptions } from 'better-auth'
import type { Payload } from 'payload'
import type { BackendEnv } from '../env'
import type { GuestLinkPolicy } from './link'
import process from 'node:process'
import { anonymous, bearer } from 'better-auth/plugins'
import { linkGuest } from './link'

export interface AuthMethods {
  emailPassword?: boolean
  /** Guest accounts created on first launch, linked to a real sign-in later. */
  anonymous?: boolean
  apple?: boolean
  google?: boolean
  /** Block email sign-in until the address is verified. Default true. */
  requireEmailVerification?: boolean
}

export interface AuthSetup {
  appName: string
  env: BackendEnv
  methods: AuthMethods
  /** Origins allowed to call the API: the web app and the native WebViews. */
  trustedOrigins: string[]
  /** What a guest's data does when they sign in to an account. Default: it moves to the account. */
  guestLink?: GuestLinkPolicy
}

/**
 * Apple's App Store rules require Sign in with Apple whenever another social sign-in is offered, so an app that
 * enables Google must also enable Apple. Checked at startup so the mistake never reaches a store review.
 */
export function validateAuthMethods(methods: AuthMethods) {
  if (!methods.emailPassword && !methods.anonymous && !methods.apple && !methods.google)
    throw new Error('Enable at least one sign-in method.')
  if (methods.google && !methods.apple)
    throw new Error('Sign in with Apple is required whenever Google sign-in is offered (App Store guideline 4.8). Enable apple too.')
}

function requireEnv(name: string, env: NodeJS.ProcessEnv, productionRuntime: boolean) {
  const value = env[name]?.trim()
  if (!value && productionRuntime)
    throw new Error(`${name} is required because this sign-in method is enabled.`)
  return value ?? ''
}

/** Builds the Better Auth options. The same object feeds the Payload collections and the Better Auth instance. */
export function buildAuthOptions(setup: AuthSetup, payload?: () => Payload | undefined): BetterAuthOptions {
  const { env, methods } = setup
  validateAuthMethods(methods)

  const send = async (to: string, subject: string, text: string) => {
    const instance = payload?.()
    if (!instance)
      throw new Error('Payload is not ready to send email yet.')
    await instance.sendEmail({ to, subject, text, html: `<p>${text.replace(/\n/g, '<br>')}</p>` })
  }

  const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {}
  if (methods.apple) {
    socialProviders.apple = {
      clientId: requireEnv('APPLE_CLIENT_ID', process.env, env.productionRuntime),
      clientSecret: requireEnv('APPLE_CLIENT_SECRET', process.env, env.productionRuntime),
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID,
    }
  }
  if (methods.google) {
    socialProviders.google = {
      clientId: requireEnv('GOOGLE_CLIENT_ID', process.env, env.productionRuntime),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET', process.env, env.productionRuntime),
    }
  }

  return {
    appName: setup.appName,
    baseURL: env.serverUrl,
    secret: env.authSecret,
    trustedOrigins: setup.trustedOrigins,
    advanced: {
      database: { generateId: 'serial' },
      useSecureCookies: env.productionRuntime,
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: env.authRateLimit,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/anonymous': { window: 60, max: 10 },
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/forget-password': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    user: {
      // `input: false` keeps the role server-only. A sign-up request can never choose it.
      additionalFields: {
        role: { type: 'string', defaultValue: 'member', input: false },
      },
    },
    emailAndPassword: {
      enabled: Boolean(methods.emailPassword),
      requireEmailVerification: methods.emailPassword ? methods.requireEmailVerification ?? true : false,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        await send(user.email, `Reset your ${setup.appName} password`, `Use this link to choose a new password:\n\n${url}\n\nIf you did not ask for this, ignore this email.`)
      },
    },
    emailVerification: {
      sendOnSignUp: Boolean(methods.emailPassword),
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await send(user.email, `Confirm your ${setup.appName} email`, `Confirm your email address with this link:\n\n${url}`)
      },
    },
    socialProviders,
    plugins: [
      // Native apps send the session token as `Authorization: Bearer <token>` instead of a cookie.
      bearer(),
      ...(methods.anonymous
        ? [anonymous({
            onLinkAccount: async ({ anonymousUser, newUser }) => {
              const instance = payload?.()
              if (instance)
                await linkGuest(instance, anonymousUser.user.id, newUser.user.id, setup.guestLink)
            },
          })]
        : []),
    ],
  }
}

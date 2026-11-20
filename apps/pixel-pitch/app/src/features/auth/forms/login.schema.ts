import * as v from 'valibot'

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.email('Enter a valid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Enter a password')),
})

export type LoginFormValues = v.InferOutput<typeof loginSchema>

/** Matches the api: Better Auth is configured with a 10 character minimum. */
export const PASSWORD_MIN_LENGTH = 10

const newPassword = v.pipe(v.string(), v.minLength(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`))

export const registerSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter your name')),
  email: v.pipe(v.string(), v.email('Enter a valid email')),
  password: newPassword,
})

export type RegisterFormValues = v.InferOutput<typeof registerSchema>

export const forgotPasswordSchema = v.object({
  email: v.pipe(v.string(), v.email('Enter a valid email')),
})

export const resetPasswordSchema = v.object({
  password: newPassword,
})

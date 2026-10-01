import * as v from 'valibot'

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.email('Enter a valid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Enter a password')),
})

export type LoginFormValues = v.InferOutput<typeof loginSchema>

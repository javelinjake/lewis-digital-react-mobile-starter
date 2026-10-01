import type { ReactNode } from 'react'
import type { Control, DefaultValues, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'
import type { GenericSchema } from 'valibot'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useEffect, useId, useSyncExternalStore } from 'react'
import { Controller, useForm } from 'react-hook-form'

const dirtyForms = new Set<string>()
const dirtyListeners = new Set<() => void>()
let dirtySnapshot = false

function publishDirty(id: string, dirty: boolean) {
  if (dirty)
    dirtyForms.add(id)
  else
    dirtyForms.delete(id)

  dirtySnapshot = dirtyForms.size > 0
  dirtyListeners.forEach(listener => listener())
}

export function hasDirtyForm() {
  return dirtySnapshot
}

function subscribeFormDirty(listener: () => void) {
  dirtyListeners.add(listener)
  return () => dirtyListeners.delete(listener)
}

export function useFormDirty() {
  return useSyncExternalStore(subscribeFormDirty, hasDirtyForm, () => false)
}

export function LdForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
}: {
  schema: GenericSchema
  defaultValues: DefaultValues<T>
  onSubmit: (values: T) => Promise<void> | void
  children: (form: UseFormReturn<T>) => ReactNode
}) {
  const form = useForm<T>({
    defaultValues,
    resolver: valibotResolver(schema as never),
  })
  const id = useId()
  const dirty = form.formState.isDirty

  useEffect(() => {
    publishDirty(id, dirty)
    return () => publishDirty(id, false)
  }, [dirty, id])

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values)
        form.reset(values)
      })}
    >
      {children(form)}
    </form>
  )
}

function FieldShell({ label, error, children }: { label: string, error?: string, children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </label>
  )
}

function TextControl<T extends FieldValues>({
  name,
  label,
  control,
  type,
}: {
  name: FieldPath<T>
  label: string
  control: Control<T>
  type: 'text' | 'email' | 'password' | 'textarea'
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FieldShell label={label} error={fieldState.error?.message}>
          {type === 'textarea'
            ? <textarea {...field} className="textarea textarea-bordered min-h-28 w-full" />
            : (
                <input
                  {...field}
                  type={type}
                  className="input input-bordered w-full"
                  autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'username' : 'off'}
                />
              )}
        </FieldShell>
      )}
    />
  )
}

export function TextInput<T extends FieldValues>(props: { name: FieldPath<T>, label: string, control: Control<T> }) {
  return <TextControl {...props} type="text" />
}

export function TextareaInput<T extends FieldValues>(props: { name: FieldPath<T>, label: string, control: Control<T> }) {
  return <TextControl {...props} type="textarea" />
}

export function EmailInput<T extends FieldValues>(props: { name: FieldPath<T>, label: string, control: Control<T> }) {
  return <TextControl {...props} type="email" />
}

export function PasswordInput<T extends FieldValues>(props: { name: FieldPath<T>, label: string, control: Control<T> }) {
  return <TextControl {...props} type="password" />
}

export function SubmitButton({ label, pending = false }: { label: string, pending?: boolean }) {
  return (
    <button type="submit" className="btn btn-primary min-h-11" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex justify-end gap-2">{children}</div>
}

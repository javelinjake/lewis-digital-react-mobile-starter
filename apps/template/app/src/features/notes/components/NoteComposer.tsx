import { FormActions, LdForm, SubmitButton, TextareaInput, TextInput } from '@ld/forms'
import { BottomSheet } from '@ld/mobile-ui'
import { notification } from '@ld/native'
import { useToast } from '@ld/ui'
import { useRef } from 'react'
import { noteSchema } from '@/features/notes/forms/note.schema'
import { useCreateNoteMutation } from '@/features/notes/mutations/use-create-note-mutation'

export function NoteComposer({ open, onClose }: { open: boolean, onClose: () => void }) {
  const mutation = useCreateNoteMutation()
  const toast = useToast()
  const idRef = useRef(crypto.randomUUID())

  if (!open)
    idRef.current = crypto.randomUUID()

  return (
    <BottomSheet open={open} title="New note" onClose={onClose}>
      <LdForm
        schema={noteSchema}
        defaultValues={{ title: '', body: '' }}
        onSubmit={async (values) => {
          const result = await mutation.mutateAsync({ ...values, id: idRef.current })
          void notification(result === 'sent' ? 'success' : 'warning')
          toast.push(result === 'sent' ? 'Note saved' : 'Saved on this device', result === 'sent' ? 'success' : 'info')
          onClose()
        }}
      >
        {form => (
          <>
            <TextInput name="title" label="Title" control={form.control} />
            <TextareaInput name="body" label="Body" control={form.control} />
            <FormActions>
              <SubmitButton label="Save" pending={form.formState.isSubmitting} />
            </FormActions>
          </>
        )}
      </LdForm>
    </BottomSheet>
  )
}

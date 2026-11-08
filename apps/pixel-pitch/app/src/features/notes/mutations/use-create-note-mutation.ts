import type { CreateNoteInput, Note } from '../types/note'
import { runOrQueue } from '@ld/offline'
import { outboxMutationDefaults } from '@ld/react-utils/query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutbox } from '@/app/use-outbox'
import { createNote } from '../api/notes-api'
import { notesOutboxTypes } from '../api/register-outbox-handlers'
import { notesQueryKeys } from '../queries/notes.keys'

export function useCreateNoteMutation() {
  const outbox = useOutbox()
  const queryClient = useQueryClient()

  return useMutation({
    ...outboxMutationDefaults,
    mutationFn: (input: CreateNoteInput) => {
      if (!outbox)
        throw new Error('Sign in before saving notes')
      return runOrQueue(outbox, notesOutboxTypes.create, input, input.id, createNote)
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: notesQueryKeys.list() })
      const previous = queryClient.getQueryData<Note[]>(notesQueryKeys.list())
      const optimistic: Note = { ...input, updatedAt: new Date().toISOString(), pending: true }
      queryClient.setQueryData<Note[]>(notesQueryKeys.list(), [optimistic, ...(previous ?? [])])
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(notesQueryKeys.list(), context.previous)
    },
    onSettled: (result) => {
      if (result === 'sent')
        void queryClient.invalidateQueries({ queryKey: notesQueryKeys.all })
    },
  })
}

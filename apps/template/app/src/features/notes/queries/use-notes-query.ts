import { useQuery } from '@tanstack/react-query'
import { readNotes } from '../api/notes-api'
import { notesQueryKeys } from './notes.keys'

export function useNotesQuery() {
  return useQuery({
    queryKey: notesQueryKeys.list(),
    queryFn: readNotes,
  })
}

export function useNoteQuery(id: string) {
  return useQuery({
    queryKey: notesQueryKeys.detail(id),
    queryFn: () => readNotes().then((notes) => {
      const note = notes.find(item => item.id === id)
      if (!note)
        throw Object.assign(new Error('Note not found'), { status: 404 })
      return note
    }),
  })
}

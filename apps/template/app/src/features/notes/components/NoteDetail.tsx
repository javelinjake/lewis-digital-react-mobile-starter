import { useOutboxSnapshot } from '@ld/react-utils/query'
import { ErrorState } from '@ld/ui'
import { formatDate } from '@ld/utils/date/format-date'
import { useOutbox } from '@/app/use-outbox'
import { mergeNotes } from '@/features/notes/queries/merge-notes'
import { useNotesQuery } from '@/features/notes/queries/use-notes-query'

export function NoteDetail({ id }: { id: string }) {
  const query = useNotesQuery()
  const snapshot = useOutboxSnapshot(useOutbox())
  const note = mergeNotes(query.data, snapshot.items).find(item => item.id === id)

  if (!note && query.isPending)
    return <p role="status">Loading note…</p>

  if (!note)
    return <ErrorState title="Note not found" />

  return (
    <article>
      <h2 className="text-xl font-semibold">{note.title}</h2>
      <p className="mt-1 text-sm opacity-70">
        {formatDate(note.updatedAt)}
        {note.pending ? ' · Pending' : ''}
      </p>
      <p className="mt-4 whitespace-pre-wrap">{note.body}</p>
    </article>
  )
}

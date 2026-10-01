import { Fab, ListGroup, ListItem, PullToRefresh } from '@ld/mobile-ui'
import { impact } from '@ld/native'
import { useOutboxSnapshot } from '@ld/react-utils/query'
import { EmptyState, ErrorState, StatusBadge } from '@ld/ui'
import { formatDate } from '@ld/utils/date/format-date'
import { useState } from 'react'
import { useOutbox } from '@/app/use-outbox'
import { NoteComposer } from '@/features/notes/components/NoteComposer'
import { mergeNotes } from '@/features/notes/queries/merge-notes'
import { useNotesQuery } from '@/features/notes/queries/use-notes-query'

export function NotesScreen() {
  const query = useNotesQuery()
  const outbox = useOutbox()
  const snapshot = useOutboxSnapshot(outbox)
  const notes = mergeNotes(query.data, snapshot.items)
  const [open, setOpen] = useState(false)

  async function refresh() {
    await outbox?.flush()
    await query.refetch()
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      {query.isPending && notes.length === 0 ? <p role="status">Loading notes…</p> : null}
      {query.isError && notes.length === 0 ? <ErrorState title="Notes are unavailable" body="You can still write a note. It will sync later." /> : null}
      {notes.length === 0 && !query.isPending ? <EmptyState title="No notes yet" body="Add one with the button below." /> : null}
      {notes.length > 0
        ? (
            <ListGroup label="Notes">
              {notes.map(note => (
                <ListItem
                  key={note.id}
                  to={`/notes/${note.id}`}
                  title={note.title}
                  subtitle={formatDate(note.updatedAt)}
                  end={note.pending ? <StatusBadge pending>Pending</StatusBadge> : null}
                />
              ))}
            </ListGroup>
          )
        : null}
      <Fab
        label="Add note"
        onClick={() => {
          void impact('light')
          setOpen(true)
        }}
      />
      <NoteComposer open={open} onClose={() => setOpen(false)} />
    </PullToRefresh>
  )
}

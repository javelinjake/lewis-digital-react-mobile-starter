import { createMemoryStorage, createOutbox, runOrQueue, scopeStorageKey } from '@ld/offline'
import { outboxMutationDefaults } from '@ld/react-utils/query'
import { beforeEach, describe, expect, it } from 'vitest'
import { createNote, listServerNoteIds, resetNotesStore } from '@/features/notes/api/notes-api'

describe('notes outbox mutation', () => {
  beforeEach(() => {
    resetNotesStore()
    sessionStorage.removeItem('ld-test-offline')
  })

  it('uses networkMode always and does not retry inside TanStack Query', () => {
    expect(outboxMutationDefaults).toEqual({ networkMode: 'always', retry: false })
  })

  it('queues an offline create and reconciles to one server record', async () => {
    sessionStorage.setItem('ld-test-offline', '1')
    const outbox = createOutbox({
      storage: createMemoryStorage(),
      storageKey: scopeStorageKey('outbox', 'template', 'user-a'),
      userId: 'user-a',
      projectId: 'template',
    })

    const result = await runOrQueue(
      outbox,
      'note:create',
      { id: 'n1', title: 'Hi', body: 'There' },
      'n1',
      createNote,
    )

    expect(result).toBe('queued')
    expect(listServerNoteIds().filter(id => id === 'n1')).toHaveLength(0)

    sessionStorage.removeItem('ld-test-offline')
    outbox.register('note:create', async (payload) => {
      await createNote(payload as { id: string, title: string, body: string })
    })
    await outbox.flush()
    await outbox.flush()

    expect(listServerNoteIds().filter(id => id === 'n1')).toHaveLength(1)
    expect(outbox.getItems()).toHaveLength(0)
  })
})

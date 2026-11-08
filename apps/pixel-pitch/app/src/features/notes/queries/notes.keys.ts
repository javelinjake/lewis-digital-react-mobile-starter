export const notesQueryKeys = {
  all: ['notes'] as const,
  list: () => ['notes', 'list'] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
}

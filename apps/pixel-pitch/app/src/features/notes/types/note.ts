export interface Note {
  id: string
  title: string
  body: string
  updatedAt: string
  pending?: boolean
}

export interface CreateNoteInput {
  id: string
  title: string
  body: string
}

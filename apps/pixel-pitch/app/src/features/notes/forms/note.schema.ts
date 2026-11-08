import * as v from 'valibot'

export const noteSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1, 'Enter a title')),
  body: v.pipe(v.string(), v.minLength(1, 'Enter a note')),
})

export type NoteFormValues = v.InferOutput<typeof noteSchema>

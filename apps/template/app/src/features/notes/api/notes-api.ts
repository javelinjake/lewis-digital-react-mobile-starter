import * as live from './notes.live'
import * as mock from './notes.mock'

// A compile-time constant, so a `live` build drops the mock (and the other way round).
const api = import.meta.env.VITE_DATA_MODE === 'live' ? live : mock

export const { readNotes, readNote, createNote } = api

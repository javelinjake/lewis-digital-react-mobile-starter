import type { Outbox } from '@ld/offline'
import { createContext } from 'react'

export const OutboxContext = createContext<Outbox | null>(null)

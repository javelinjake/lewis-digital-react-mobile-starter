import type { Outbox } from '@ld/offline'
import { createContext } from 'react'

export const OutboxContext = createContext<Outbox | null>(null)

export function OutboxProvider({ value, children }: { value: Outbox | null, children: React.ReactNode }) {
  return <OutboxContext value={value}>{children}</OutboxContext>
}

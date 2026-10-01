import type { Outbox } from '@ld/offline'
import type { ReactNode } from 'react'
import { OutboxContext } from './outbox-context'

export function OutboxProvider({ value, children }: { value: Outbox | null, children: ReactNode }) {
  return <OutboxContext value={value}>{children}</OutboxContext>
}

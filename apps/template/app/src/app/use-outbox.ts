import { use } from 'react'
import { OutboxContext } from './outbox-context'

export function useOutbox() {
  return use(OutboxContext)
}

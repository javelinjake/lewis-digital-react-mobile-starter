import type { Ticket } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { playConfig } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { useGameConfig } from '../queries/use-game'
import { PlayConfigContext } from '../queries/use-play-config'

/**
 * Wraps a play of a game in the tuning its ticket was issued at: quicker in each league, and a single round for a
 * match moment. The server replays the taps with the same tuning (`playConfig`), so what the player sees is what is
 * scored.
 */
export function PlayTuning({ ticket, children }: { ticket: Pick<Ticket, 'kind' | 'tier'>, children: ReactNode }) {
  const config = useGameConfig()
  const tuned = useMemo(() => playConfig(config, ticket), [config, ticket])
  return <PlayConfigContext value={tuned}>{children}</PlayConfigContext>
}

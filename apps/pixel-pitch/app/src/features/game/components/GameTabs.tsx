import type { TabBarItem } from '@ld/mobile-ui'
import { energyAt } from '@ld/pixel-pitch-core'
import { Link } from 'react-router'
import { TabsLayout } from '@/components/layout/TabsLayout'
import { claimCount, readyItems } from '../lib/ready-now'
import { useCatalogue, useClub, useGameConfig } from '../queries/use-game'
import { Icon } from './sprites'

/**
 * The game's five tabs, each with a count of what is waiting there, and Settings behind a button in the header. The
 * tabs live here, with the game, and the layout that draws them is the generic one.
 */
export function GameTabs() {
  const { data: game } = useClub()
  const config = useGameConfig()
  const { data: catalogue } = useCatalogue()

  const items = game ? readyItems(game, config, catalogue ?? []) : []
  const { state } = game?.club ?? {}
  const tabs: TabBarItem[] = [
    { to: '/club', label: 'Club', badge: claimCount(items) },
    { to: '/packs', label: 'Packs', badge: state ? state.idle.shelfPacks + state.starPacks : 0 },
    { to: '/squad', label: 'Squad' },
    { to: '/arcade', label: 'Arcade', badge: game && state ? energyAt(state, config, game.now) : 0 },
    { to: '/league', label: 'League' },
  ]

  return (
    <TabsLayout
      items={tabs}
      end={(
        <Link to="/settings" className="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label="Settings">
          <Icon path="icons/ui_settings.png" scale={2} />
        </Link>
      )}
    />
  )
}

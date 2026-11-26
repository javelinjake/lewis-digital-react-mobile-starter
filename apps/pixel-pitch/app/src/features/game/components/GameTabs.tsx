import type { TabBarItem } from '@ld/mobile-ui'
import { albumSets, energyAt } from '@ld/pixel-pitch-core'
import { Link } from 'react-router'
import { TabsLayout } from '@/components/layout/TabsLayout'
import { claimable } from '../lib/claimable'
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
  const waiting = game ? claimable(game, config, albumSets(catalogue ?? [], config)) : { goals: 0, pass: 0, album: 0 }
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
        <>
          <HeaderLink to="/goals" label="Goals" icon="icons/ui_check.png" count={waiting.goals} />
          <HeaderLink to="/pass" label="League Pass" icon="icons/currency_trophy.png" count={waiting.pass} />
          <HeaderLink to="/settings" label="Settings" icon="icons/ui_settings.png" count={0} />
        </>
      )}
    />
  )
}

/** A header button with a count of what is waiting behind it. */
function HeaderLink({ to, label, icon, count }: { to: string, label: string, icon: string, count: number }) {
  return (
    <Link to={to} className="btn btn-ghost btn-circle relative min-h-11 min-w-11" aria-label={count > 0 ? `${label}, ${count} to claim` : label}>
      <Icon path={icon} scale={2} />
      {count > 0 ? <span className="absolute right-0 top-0 min-w-4 bg-secondary px-1 text-center text-[10px] leading-4 text-secondary-content" aria-hidden="true">{count > 9 ? '9+' : count}</span> : null}
    </Link>
  )
}

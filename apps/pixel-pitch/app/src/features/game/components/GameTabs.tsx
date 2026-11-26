import type { GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import type { IconTab } from '@/components/layout/GameChrome'
import { albumSets, energyAt, promotionGate } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { HeaderButton, ScreenHeader } from '@/components/layout/GameChrome'
import { TabsLayout } from '@/components/layout/TabsLayout'
import { claimable } from '../lib/claimable'
import { kitOf, leagueName, nextRival, serverOffset } from '../lib/club'
import { claimCount, readyItems } from '../lib/ready-now'
import { useCatalogue, useClub, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
import { Crest, Icon } from './sprites'

/** Coins, gems and tokens, always in sight at the top of the club and the shops. */
function Wallet({ game }: { game: GameResponse }) {
  const { state } = game.club
  const cells = [
    { icon: 'icons/currency_coin.png', label: 'Coins', value: state.coins.toLocaleString('en-GB') },
    { icon: 'icons/currency_gem.png', label: 'Gems', value: String(state.idle.gems) },
    { icon: 'icons/currency_token.png', label: 'Tokens', value: String(state.tokens) },
  ]
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Wallet">
      {cells.map(cell => (
        <span key={cell.label} className="flex h-9 items-center gap-1.5 bg-base-200 px-2 shadow-[inset_0_0_0_2px_var(--color-slate)]">
          <Icon path={cell.icon} label={cell.label} />
          <span className="font-semibold tabular-nums">{cell.value}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * The game's five tabs, each with an icon and a count of what is waiting there, and the header above them: the club's
 * crest and money on the club screen, a line about what the screen is for on the others, Goals and Settings on the
 * right everywhere. The tabs live here, with the game; the layout that draws them is the app's.
 */
export function GameTabs() {
  const { data: game } = useClub()
  const config = useGameConfig()
  const { data: catalogue } = useCatalogue()
  const { pathname } = useLocation()
  const offset = useMemo(() => (game ? serverOffset(game, Date.now()) : 0), [game])

  const items = game ? readyItems(game, config, catalogue ?? []) : []
  const waiting = game ? claimable(game, config, albumSets(catalogue ?? [], config)) : { goals: 0, pass: 0, album: 0 }
  const { state } = game?.club ?? {}
  const tabs: IconTab[] = [
    { to: '/club', label: 'Club', icon: 'club', badge: claimCount(items) },
    { to: '/packs', label: 'Packs', icon: 'packs', badge: state ? state.idle.shelfPacks + state.starPacks : 0 },
    { to: '/squad', label: 'Squad', icon: 'squad' },
    { to: '/arcade', label: 'Arcade', icon: 'arcade', badge: game && state ? energyAt(state, config, game.now) : 0 },
    { to: '/league', label: 'League', icon: 'league' },
  ]

  const end = (
    <>
      <HeaderButton to="/goals" label="Goals and League Pass" icon="goals" count={waiting.goals + waiting.pass} />
      <HeaderButton to="/settings" label="Settings" icon="settings" />
    </>
  )

  let header: ReactNode = <ScreenHeader title="Pixel Pitch" end={end} />
  if (game && state) {
    const wallet = <Wallet game={game} />
    const rival = nextRival(game, config)
    const screen = pathname.split('/')[1]
    if (screen === 'club') {
      header = (
        <ScreenHeader
          highlight
          title={game.club.name}
          sub={`${leagueName(state.league.tier)} · ${state.league.points}/${promotionGate(state.league.tier, config)} pts`}
          crest={<Crest crest={game.club.crest} kit={kitOf(game)} scale={3} label={`${game.club.name} crest`} />}
          end={end}
          below={wallet}
        />
      )
    }
    else if (screen === 'packs') {
      header = <ScreenHeader title="Packs" sub="Sign players · three to a pack" end={end} below={wallet} />
    }
    else if (screen === 'arcade') {
      header = <ScreenHeader title="Arcade" sub="Win tokens for Arcade packs" end={end} below={wallet} />
    }
    else if (screen === 'squad') {
      header = (
        <ScreenHeader
          title="Squad"
          sub={(
            <>
              {`Next: ${rival.name} in `}
              <Countdown to={state.league.nextKickoffAt} offset={offset} />
            </>
          )}
          end={end}
        />
      )
    }
    else if (screen === 'league') {
      header = <ScreenHeader title={leagueName(state.league.tier)} sub={`${promotionGate(state.league.tier, config)} pts to go up · no relegation`} end={end} />
    }
  }

  return <TabsLayout items={tabs} header={header} />
}

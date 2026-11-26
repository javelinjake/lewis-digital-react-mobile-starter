import type { GameResponse } from '@ld/pixel-pitch-core'
import { FREE_KITS } from '@ld/pixel-pitch-core'
import { EmptyState, LoadingState, useToast } from '@ld/ui'
import { Link } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useGameAction } from '../mutations/use-game-action'
import { useClub, useGameConfig } from '../queries/use-game'
import { Crest, Icon } from './sprites'

interface KitRow {
  key: string
  name: string
  primary: string
  secondary: string
  /** Gems, for a premium kit not yet bought. */
  price: number | null
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * The shop: gems for looks, never for power. Kits for now; every kit the club owns can be worn, free or bought. What
 * is never for sale is said here too.
 */
function Shop({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const buy = useGameAction((kitId: string) => gameApi.buyKit(kitId))
  const wear = useGameAction(([primary, secondary]: [string, string]) => gameApi.wearKit(primary, secondary))
  const { club } = game
  const gems = club.state.idle.gems
  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const busy = buy.isPending || wear.isPending

  const rows: KitRow[] = [
    ...config.shop.kits.map(kit => ({ key: kit.id, name: kit.name, primary: kit.primary, secondary: kit.secondary, price: club.state.cosmetics.includes(kit.id) ? null : kit.gems })),
    ...FREE_KITS.map(([primary, secondary, name]) => ({ key: name, name, primary, secondary, price: null })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-3 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Gems">
        <Icon path="icons/currency_gem.png" label="Gems" scale={3} />
        <span className="flex-1 text-lg tabular-nums">{`${gems} gems`}</span>
        <span className="text-sm text-muted">Gems come with each day, goals, medals and the League Pass.</span>
      </section>

      <section className="flex flex-col gap-2" aria-label="Kits">
        <h2>Kits</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {rows.map((row) => {
            const wearing = same(club.kitPrimary, row.primary) && same(club.kitSecondary, row.secondary)
            return (
              <li key={row.key} className={`flex flex-col items-center gap-2 bg-base-100 p-3 text-center ${wearing ? 'shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'shadow-[inset_0_0_0_2px_var(--color-slate)]'}`} aria-label={row.name}>
                <Crest crest={club.crest} kit={[row.primary, row.secondary]} scale={3} />
                <span className="text-sm">{row.name}</span>
                {wearing
                  ? <span className="font-display text-xs text-primary">Wearing</span>
                  : row.price !== null
                    ? (
                        <button type="button" className="btn btn-accent min-h-11 w-full" disabled={busy || gems < row.price} onClick={() => buy.mutate(row.key, { onSuccess: () => toast.push(`${row.name} is yours.`, 'success'), onError })}>
                          {`${row.price} gems`}
                        </button>
                      )
                    : <button type="button" className="btn btn-outline min-h-11 w-full" disabled={busy} onClick={() => wear.mutate([row.primary, row.secondary], { onError })}>Wear</button>}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-1 bg-base-100 p-3 text-sm shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Fair play">
        <span className="font-bold">Never for sale</span>
        <span className="text-muted">Daily challenge attempts and places on a leaderboard. The shop sells looks, not wins.</span>
        <Link to="/packs" className="link text-primary">See the pack odds</Link>
      </section>
    </div>
  )
}

export function ShopScreen() {
  const club = useClub()
  if (!club.data)
    return club.isPending ? <LoadingState message="Loading your club…" /> : <EmptyState title="No club yet" />
  return <Shop game={club.data} />
}

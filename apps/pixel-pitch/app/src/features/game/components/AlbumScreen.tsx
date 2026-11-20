import type { GameResponse } from '@ld/pixel-pitch-core'
import { albumPower, albumSets, isSetComplete, NATIONS } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useMemo } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { kitOf } from '../lib/club'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { RewardText } from './RewardText'
import { PlayerSprite } from './sprites'

const surname = (name: string) => name.split(' ').at(-1) ?? name

/** The collection book: sets of six by nation and position. Each finished set is +1% team power and a reward. */
export function AlbumScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { data: catalogue, lookup } = useCatalogue()
  const { state } = game.club
  const kit = kitOf(game)
  const claim = useGameAction((setId: string) => gameApi.claimAlbumSet(setId))
  const sets = useMemo(() => albumSets(catalogue ?? [], config), [catalogue, config])
  const collected = useMemo(() => new Set(state.album.collected), [state.album.collected])
  const power = albumPower(state, config)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 border-2 border-slate bg-base-100 p-3" aria-label="Album progress">
        <div className="flex items-baseline justify-between">
          <h2>Album</h2>
          <span className="tabular-nums">{`${state.album.completed} / ${sets.length} sets`}</span>
        </div>
        <span className={power > 0 ? 'text-success' : 'text-muted'}>{`Team power +${Math.round(power * 100)}%`}</span>
        <span className="text-muted">Players you pull stay in the book even if you sell them. Finish a set for a reward and +1% team power.</span>
      </section>

      {NATIONS.map((nation, nationIndex) => {
        const group = sets.filter(set => set.nation === nationIndex)
        if (group.length === 0)
          return null
        return (
          <section key={nation} className="flex flex-col gap-2" aria-label={nation}>
            <h2>{nation}</h2>
            <ul className="flex flex-col gap-2">
              {group.map((set) => {
                const have = set.playerIds.filter(id => collected.has(id)).length
                const complete = isSetComplete(set, collected)
                const claimed = state.album.claimed.includes(set.id)
                return (
                  <li key={set.id} className={`flex flex-col gap-2 border-2 p-2 ${complete ? 'border-primary bg-base-100' : 'border-slate bg-base-100'}`} aria-label={set.name}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg">{set.name}</span>
                      <span className="tabular-nums text-muted">{`${have}/${set.playerIds.length}`}</span>
                    </div>
                    <ul className="grid grid-cols-6 gap-1">
                      {set.playerIds.map((id) => {
                        const player = lookup(id)
                        const owned = collected.has(id)
                        return (
                          <li key={id} className="flex flex-col items-center" aria-label={owned && player ? player.name : 'Not collected yet'}>
                            <span className={owned ? '' : 'opacity-25 brightness-0'}>{player ? <PlayerSprite player={player} kit={kit} scale={2} /> : null}</span>
                            <span className="max-w-full truncate text-xs leading-none text-muted">{owned && player ? surname(player.name) : '???'}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {complete
                      ? (
                          <div className="flex items-center justify-between">
                            <RewardText reward={config.album.reward} />
                            <button type="button" className="btn btn-sm btn-primary min-h-11" disabled={claimed || claim.isPending} onClick={() => claim.mutate(set.id, { onError: error => toast.push(formatError(error), 'error') })}>
                              {claimed ? 'Claimed' : 'Claim'}
                            </button>
                          </div>
                        )
                      : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

import type { GameResponse } from '@ld/pixel-pitch-core'
import { benchCount, benchLimit, NATIONS, signingOffer } from '@ld/pixel-pitch-core'
import { EmptyState, LoadingState, useToast } from '@ld/ui'
import { Link, useNavigate } from 'react-router'
import { telemetry } from '@/lib/telemetry/telemetry'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { kitOf } from '../lib/club'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { PlayerCard } from './PlayerCard'

/** A Star Signing: three named Star players, all shown, and the player picks one. Nothing is rolled. */
export function SigningScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const catalogue = useCatalogue()
  const choose = useGameAction((playerId: string) => gameApi.chooseSigning(playerId))
  const { state } = game.club

  if (state.signings.pending < 1) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState title="No Star Signing to use" body="Star Signings come from the League Pass and the starter offer." />
        <Link to="/shop" className="btn btn-primary min-h-11">Shop</Link>
      </div>
    )
  }
  if (!catalogue.data)
    return <LoadingState message="Scouting players…" />

  const offer = signingOffer(state, game.club.id, catalogue.data)
  const full = benchCount(game.cards, state.lineup) >= benchLimit(state, config)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg">{state.signings.pending > 1 ? `You have ${state.signings.pending} Star Signings. Pick a player for this one.` : 'Pick one of these Star players to join your squad.'}</p>
      {full ? <p className="border-2 border-warning bg-base-100 p-3">Your bench is full. Sell a player in the Squad tab first.</p> : null}
      <ul className="flex flex-col gap-3">
        {offer.map(player => (
          <li key={player.id} className="flex items-center gap-3 border-2 border-slate bg-base-100 p-3">
            <PlayerCard player={player} rating={player.rating} kit={kitOf(game)} scale={2} />
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xl">{player.name}</span>
              <span className="text-muted">{`${player.position}${player.altPosition ? ` / ${player.altPosition}` : ''} · ${NATIONS[player.nation]} · ${player.rating}`}</span>
              <button
                type="button"
                className="btn btn-primary min-h-11 font-display text-xs"
                disabled={full || choose.isPending}
                onClick={() => choose.mutate(player.id, {
                  onSuccess: () => {
                    telemetry.track('signing_chosen')
                    toast.push(`${player.name} has signed.`, 'success')
                    if (state.signings.pending <= 1)
                      navigate('/squad')
                  },
                  onError: error => toast.push(formatError(error), 'error'),
                })}
              >
                Sign
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

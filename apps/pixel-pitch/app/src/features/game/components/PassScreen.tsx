import type { GameResponse, PassTrack } from '@ld/pixel-pitch-core'
import { dayIndex, maxXp, tierReached } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { RewardText } from './RewardText'

/** The four-week League Pass season: 30 tiers earned with XP, a free reward track and a premium one. */
export function PassScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const claim = useGameAction((input: { track: PassTrack, tier: number }) => gameApi.claimPassTier(input.track, input.tier))
  const reached = tierReached(state, config)
  const tiers = config.pass.premium.length
  const seasonStart = state.pass.season * config.pass.seasonDays
  const daysLeft = Math.max(0, seasonStart + config.pass.seasonDays - dayIndex(game.now, config))
  const hasPass = state.idle.hasPass

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Season">
        <div className="flex items-baseline justify-between">
          <h2>This season</h2>
          <span className="text-muted">{`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}</span>
        </div>
        <div className="flex items-baseline justify-between text-lg">
          <span>{`Tier ${reached} / ${tiers}`}</span>
          <span className="tabular-nums text-muted">{`${state.pass.xp} / ${maxXp(config)} XP`}</span>
        </div>
        <div className="h-3 w-full bg-base-300" role="progressbar" aria-label="Pass XP" aria-valuenow={state.pass.xp} aria-valuemin={0} aria-valuemax={maxXp(config)}>
          <div className="h-full bg-primary" style={{ width: `${(state.pass.xp / maxXp(config)) * 100}%` }} />
        </div>
        <span className="text-muted">{`Earn XP from matches, packs, the arcade and goals. ${config.pass.xpPerTier} XP a tier.`}</span>
        <span className={hasPass ? 'text-success' : 'text-muted'}>
          {hasPass ? 'League Pass active: both tracks, bigger shelf and trays.' : 'Free track. The League Pass (coming to the shop) adds the premium track, and unlocks every tier you have already passed.'}
        </span>
      </section>

      <ol className="flex flex-col gap-1" aria-label="Tiers">
        {Array.from({ length: tiers }, (_, index) => {
          const tier = index + 1
          const unlocked = tier <= reached
          const cell = (track: PassTrack) => {
            const reward = track === 'free' ? config.pass.free[index] : config.pass.premium[index]
            const claimed = (track === 'free' ? state.pass.claimedFree : state.pass.claimedPremium).includes(tier)
            if (!reward)
              return <span className="text-muted">None</span>
            const canClaim = unlocked && !claimed && (track === 'free' || hasPass)
            return (
              <div className="flex flex-col items-start gap-1">
                <RewardText reward={reward} />
                {claimed
                  ? <span className="text-success">Claimed</span>
                  : canClaim
                    ? <button type="button" className="btn btn-xs btn-primary min-h-11 px-3" aria-label={`Claim ${track} tier ${tier}`} disabled={claim.isPending} onClick={() => claim.mutate({ track, tier }, { onError: error => toast.push(formatError(error), 'error') })}>Claim</button>
                    : <span className="text-muted">{!unlocked ? 'Locked' : 'Needs the Pass'}</span>}
              </div>
            )
          }
          return (
            <li key={tier} className={`grid grid-cols-[3rem_1fr_1fr] items-center gap-2 border-2 p-2 ${unlocked ? 'border-slate bg-base-100' : 'border-base-300 opacity-70'}`} aria-label={`Tier ${tier}${unlocked ? ', reached' : ''}`}>
              <span className="font-display text-xs">{tier}</span>
              <div aria-label={`Tier ${tier} free reward`}>{cell('free')}</div>
              <div aria-label={`Tier ${tier} premium reward`}>{cell('premium')}</div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

import type { GameResponse, GoalKind } from '@ld/pixel-pitch-core'
import { CALENDAR_DAYS, dayIndex, nextCalendarDay } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { Link, useNavigate } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { rewardWords } from '../lib/reward-words'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { RewardText } from './RewardText'

/** Where each kind of goal is done, so a goal can take you there. */
const GOAL_ROUTE: Record<GoalKind, { to: string, label: string }> = {
  openPacks: { to: '/packs', label: 'Open packs' },
  winMatches: { to: '/squad', label: 'Set the lineup' },
  playCabinets: { to: '/arcade', label: 'Go to the arcade' },
  trainPlayers: { to: '/squad?view=train', label: 'Train a player' },
  signPlayers: { to: '/packs', label: 'Open packs' },
  collectStadium: { to: '/club', label: 'Go to the stadium' },
}

/** Today's three goals, the Daily Free Pack and the 7-day login calendar. */
export function GoalsScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const { state } = game.club
  const today = dayIndex(game.now, config)
  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const claimGoal = useGameAction((goalId: string) => gameApi.claimGoal(goalId))
  const freePack = useGameAction(() => gameApi.claimFreePack())
  const calendar = useGameAction(() => gameApi.claimCalendar())

  const next = nextCalendarDay(state.calendar, today)
  const claimedUpTo = next === null ? state.calendar.streak : next === 1 ? 0 : next - 1

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Daily free pack">
        <h2>Daily Free Pack</h2>
        <button
          type="button"
          className="btn btn-primary min-h-11 font-display text-xs"
          disabled={state.daily.freePackClaimed || freePack.isPending}
          // Straight to the opening: the pack goes on the shelf and the Packs screen opens it.
          onClick={() => freePack.mutate(undefined, { onError, onSuccess: () => navigate('/packs?open=1') })}
        >
          {state.daily.freePackClaimed ? 'Taken today. Back tomorrow.' : config.daily.freePackCount === 1 ? 'Open your free pack' : `Open your ${config.daily.freePackCount} free packs`}
        </button>
      </section>

      <section className="flex flex-col gap-2" aria-label="Daily goals">
        <h2>Today's goals</h2>
        <ul className="flex flex-col gap-2">
          {state.daily.goals.map((goal) => {
            const definition = config.daily.goals.find(entry => entry.id === goal.id)
            const done = goal.progress >= goal.target
            const route = GOAL_ROUTE[goal.kind]
            return (
              <li key={goal.id} className={`flex flex-col gap-2 border-2 bg-base-100 p-3 ${goal.claimed ? 'border-success opacity-80' : done ? 'border-primary' : 'border-slate'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg">{(definition?.label ?? goal.kind).replace('{n}', String(goal.target))}</span>
                  <span className="tabular-nums text-muted">{`${goal.progress}/${goal.target}`}</span>
                </div>
                <div className="h-3 w-full bg-base-300" role="progressbar" aria-label={definition?.label.replace('{n}', String(goal.target))} aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={goal.target}>
                  <div className={`h-full ${done ? 'bg-success' : 'bg-primary'}`} style={{ width: `${(goal.progress / goal.target) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  {definition ? <RewardText reward={definition.reward} /> : <span />}
                  {goal.claimed
                    ? <span className="text-lg text-success">✓ Claimed</span>
                    : done
                      ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary min-h-11"
                            disabled={claimGoal.isPending}
                            onClick={() => claimGoal.mutate(goal.id, { onError, onSuccess: () => toast.push(definition ? `Goal claimed: +${rewardWords(definition.reward)}` : 'Goal claimed', 'success') })}
                          >
                            Claim
                          </button>
                        )
                      : <Link to={route.to} className="btn btn-sm btn-outline min-h-11">{`${route.label} ›`}</Link>}
                </div>
              </li>
            )
          })}
        </ul>
        <span className="text-muted">New goals every day. Each one you finish also earns League Pass XP.</span>
      </section>

      <section className="flex flex-col gap-2" aria-label="Login calendar">
        <h2>Login calendar</h2>
        <ol className="grid grid-cols-7 gap-1">
          {Array.from({ length: CALENDAR_DAYS }, (_, index) => {
            const day = index + 1
            const claimed = day <= claimedUpTo
            const current = day === next
            return (
              <li key={day} className={`flex min-h-20 flex-col items-center justify-between gap-1 border-2 p-1 text-center text-sm ${current ? 'border-primary bg-base-100' : claimed ? 'border-success bg-base-300' : 'border-slate'}`} aria-label={`Day ${day}${claimed ? ', claimed' : current ? ', ready' : ''}`}>
                <span className="font-display text-[0.5rem]">{`D${day}`}</span>
                <RewardText reward={config.calendar.rewards[index]} />
                <span className={claimed ? 'text-success' : 'text-muted'}>{claimed ? '✓' : ' '}</span>
              </li>
            )
          })}
        </ol>
        <button type="button" className="btn btn-accent min-h-11 font-display text-xs" disabled={next === null || calendar.isPending} onClick={() => calendar.mutate(undefined, { onError })}>
          {next === null ? 'Claimed today. Back tomorrow.' : `Claim day ${next}`}
        </button>
        <span className="text-muted">Come back every day. Miss one and it starts again. Day 7 is a Star pack.</span>
      </section>
    </div>
  )
}

import type { GameResponse, GoalKind } from '@ld/pixel-pitch-core'
import { CALENDAR_DAYS, dayIndex, maxXp, nextCalendarDay, tierReached } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { Link } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { serverOffset } from '../lib/club'
import { rewardWords } from '../lib/reward-words'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
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

const DAY = 24 * 60 * 60 * 1000

/** The League Pass's progress, today's three goals (each goes to where it is done), and the 7-day login streak. */
export function GoalsScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const today = dayIndex(game.now, config)
  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const claimGoal = useGameAction((goalId: string) => gameApi.claimGoal(goalId))
  const calendar = useGameAction(() => gameApi.claimCalendar())

  const next = nextCalendarDay(state.calendar, today)
  const claimedUpTo = next === null ? state.calendar.streak : next === 1 ? 0 : next - 1

  const reached = tierReached(state, config)
  const tierXp = state.pass.xp - reached * config.pass.xpPerTier
  const atTop = state.pass.xp >= maxXp(config)

  const resetsAt = (today + 1) * DAY + config.daily.dayStartOffsetMinutes * 60_000
  const offset = serverOffset(game, Date.now())
  const nextReward = next === null ? null : config.calendar.rewards[next - 1]

  return (
    <div className="flex flex-col gap-3">
      <Link to="/pass" className="flex flex-col gap-1.5 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="League Pass">
        <span className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-primary">{`League Pass · Tier ${reached}`}</span>
          <span className="text-accent">View ›</span>
        </span>
        <span className="h-2 bg-base-200" aria-hidden="true"><span className="block h-2 bg-accent" style={{ width: `${atTop ? 100 : (tierXp / config.pass.xpPerTier) * 100}%` }} /></span>
        <span className="text-sm text-muted">{atTop ? 'Every tier reached this season.' : `${tierXp} of ${config.pass.xpPerTier} XP to the next tier · each goal adds ${config.pass.xp.goal} XP`}</span>
      </Link>

      <section className="flex flex-col gap-2" aria-label="Daily goals">
        <div className="flex items-baseline justify-between">
          <span className="pp-label">Today</span>
          <span className="text-sm text-muted">
            {'New goals in '}
            <Countdown to={resetsAt} offset={offset} />
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {state.daily.goals.map((goal) => {
            const definition = config.daily.goals.find(entry => entry.id === goal.id)
            const done = goal.progress >= goal.target
            const route = GOAL_ROUTE[goal.kind]
            const label = (definition?.label ?? goal.kind).replace('{n}', String(goal.target))
            return (
              <li
                key={goal.id}
                className={`flex items-center gap-3 p-3 ${goal.claimed ? 'bg-base-100 opacity-80 shadow-[inset_0_0_0_2px_var(--color-success)]' : done ? 'bg-raised shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]'}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{label}</span>
                    <span className="shrink-0 text-sm whitespace-nowrap text-muted tabular-nums">{`${goal.progress} / ${goal.target}`}</span>
                  </div>
                  <div className="h-2 bg-base-200" role="progressbar" aria-label={label} aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={goal.target}>
                    <div className="h-full bg-success" style={{ width: `${(goal.progress / goal.target) * 100}%` }} />
                  </div>
                  {definition ? <span className="text-sm"><RewardText reward={definition.reward} /></span> : null}
                </div>
                {goal.claimed
                  ? <span className="w-20 shrink-0 text-center font-bold text-success">✓ Claimed</span>
                  : done
                    ? (
                        <button
                          type="button"
                          className="btn btn-primary min-h-12 w-20 shrink-0"
                          disabled={claimGoal.isPending}
                          onClick={() => claimGoal.mutate(goal.id, { onError, onSuccess: () => toast.push(definition ? `Goal claimed: +${rewardWords(definition.reward)}` : 'Goal claimed', 'success') })}
                        >
                          Claim
                        </button>
                      )
                    : <Link to={route.to} className="btn btn-outline min-h-12 w-20 shrink-0 px-1 text-sm leading-tight" aria-label={`${route.label} ›`}>Go ›</Link>}
              </li>
            )
          })}
        </ul>
        <span className="text-sm text-muted">Each goal you finish also earns League Pass XP.</span>
      </section>

      <section className="flex flex-col gap-2.5 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Login calendar">
        <div className="flex items-baseline justify-between">
          <span className="pp-label">Login streak</span>
          <span className="text-sm text-muted">{`Day ${next ?? claimedUpTo} of ${CALENDAR_DAYS}`}</span>
        </div>
        <ol className="grid grid-cols-7 gap-1">
          {Array.from({ length: CALENDAR_DAYS }, (_, index) => {
            const day = index + 1
            const claimed = day <= claimedUpTo
            const current = day === next
            const last = day === CALENDAR_DAYS
            return (
              <li
                key={day}
                className={`flex min-h-18 flex-col items-center justify-between gap-0.5 px-0.5 py-1 text-center text-xs ${current ? 'bg-raised text-primary shadow-[inset_0_0_0_3px_var(--color-primary)]' : claimed ? 'bg-base-200 text-success shadow-[inset_0_0_0_2px_var(--color-success)]' : last ? 'bg-base-200 shadow-[inset_0_0_0_2px_var(--color-warning)]' : 'bg-base-200 shadow-[inset_0_0_0_2px_var(--color-slate)]'}`}
                aria-label={`Day ${day}${claimed ? ', claimed' : current ? ', ready' : ''}`}
              >
                <span className="font-bold">{`D${day}`}</span>
                <RewardText reward={config.calendar.rewards[index]} compact />
                <span aria-hidden="true">{claimed ? '✓' : ' '}</span>
              </li>
            )
          })}
        </ol>
        <button type="button" className="btn btn-primary h-12 text-base" disabled={next === null || calendar.isPending} onClick={() => calendar.mutate(undefined, { onError })}>
          {next === null || !nextReward ? 'Claimed today. Back tomorrow.' : `Claim day ${next} · ${rewardWords(nextReward)}`}
        </button>
        <span className="text-sm text-muted">Come back every day. Miss one and it starts again. Day 7 is a Star pack.</span>
      </section>
    </div>
  )
}

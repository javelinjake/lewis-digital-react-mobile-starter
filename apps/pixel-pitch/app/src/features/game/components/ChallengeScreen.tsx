import type { AnyTaps, BoardEntry, ChallengeResult, GameResponse } from '@ld/pixel-pitch-core'
import { challengeCabinet, challengePlayed, dayIndex, MEDALS, weekToClaim } from '@ld/pixel-pitch-core'
import { EmptyState, LoadingState, useToast } from '@ld/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CABINETS } from '../lib/cabinets'
import { serverOffset } from '../lib/club'
import { medalName } from '../lib/medals'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { gameKeys } from '../queries/game.keys'
import { useClub, useGameConfig } from '../queries/use-game'
import { cabinetGame } from './cabinet-games'
import { Countdown } from './Countdown'
import { MedalTargets } from './Medals'
import { PlayTuning } from './PlayTuning'
import { RewardText } from './RewardText'
import { Crest } from './sprites'

const DAY = 24 * 60 * 60_000

function Rows({ rows, unit, label }: { rows: BoardEntry[], unit: string, label: string }) {
  if (rows.length === 0)
    return <span className="text-muted">Nobody on the board yet.</span>
  return (
    <ol className="flex flex-col" aria-label={label}>
      {rows.map(row => (
        <li
          key={`${row.rank}-${row.clubName}`}
          className={`flex min-h-11 items-center gap-2 px-2 ${row.you ? 'bg-raised font-bold text-primary shadow-[inset_4px_0_0_var(--color-primary)]' : 'border-b border-base-300'}`}
        >
          <span className="w-8 tabular-nums">{row.rank}</span>
          <Crest crest={row.crest} kit={[row.kitPrimary, row.kitSecondary]} scale={1} />
          <span className="min-w-0 flex-1 truncate">{row.clubName}</span>
          {row.days !== undefined ? <span className="text-sm text-muted tabular-nums">{`${row.days}d`}</span> : null}
          <span className="tabular-nums">{`${row.score.toLocaleString('en-GB')} ${unit}`}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The daily challenge: today's game in endless mode, the same pattern for every player, one scored attempt. Then the
 * day's board and the week's (the best five days count). Last week's reward is taken here.
 */
function Challenge({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const toast = useToast()
  const client = useQueryClient()
  const now = useServerNow(game)
  const offset = serverOffset(game, Date.now())
  const board = useQuery({ queryKey: gameKeys.board(), queryFn: gameApi.readBoard, staleTime: 60_000 })
  const start = useGameAction(() => gameApi.startChallenge())
  const finish = useGameAction((taps: AnyTaps) => gameApi.finishChallenge(taps))
  const weekly = useGameAction(() => gameApi.claimWeekly())
  const [playing, setPlaying] = useState(false)
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [tab, setTab] = useState<'today' | 'week'>('today')
  const { state } = game.club
  const cabinet = challengeCabinet(now, config)
  const info = CABINETS.find(entry => entry.cabinet === cabinet)!
  const played = challengePlayed(state, now, config)
  const ticket = state.ticket?.kind === 'challenge' ? state.ticket : null
  const targets = config.challenge.targets[cabinet]
  const day = dayIndex(now, config)
  const nextAt = (day + 1) * DAY + config.daily.dayStartOffsetMinutes * 60_000
  const weekWaiting = weekToClaim(state, now, config) !== null
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  if (playing && ticket?.cabinet) {
    const Game = cabinetGame(ticket.cabinet)
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-primary">{`Daily challenge: ${info.name}`}</h2>
        <span className="text-sm text-muted">Endless: it speeds up until you fail.</span>
        {finish.isPending ? <span className="text-muted">Checking your play…</span> : null}
        <PlayTuning ticket={ticket}>
          <Game
            key={ticket.id}
            seed={ticket.seed}
            onFinish={taps => finish.mutate(taps, {
              onSuccess: (response) => {
                setResult(response)
                setPlaying(false)
                void client.invalidateQueries({ queryKey: gameKeys.board() })
              },
              onError: (error) => {
                onError(error)
                setPlaying(false)
              },
            })}
          />
        </PlayTuning>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {weekWaiting
        ? (
            <section className="flex items-center gap-3 bg-raised p-3 shadow-[inset_0_0_0_3px_var(--color-primary)]" aria-label="Last week">
              <span className="flex-1">Last week is over. See how you did.</span>
              <button
                type="button"
                className="btn btn-primary min-h-12"
                disabled={weekly.isPending}
                onClick={() => weekly.mutate(undefined, {
                  onSuccess: response => toast.push(response.label ? `${response.label}! Rewards added.` : 'No reward last week. Play three days for one.', 'success'),
                  onError,
                })}
              >
                Claim
              </button>
            </section>
          )
        : null}

      <section className="flex flex-col gap-2 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-primary)]" aria-label="Today's challenge">
        <span className="pp-label">{`Today · ${info.name}`}</span>
        <span className="text-lg">Endless mode: everyone gets the same pattern, and it speeds up until you fail. One scored attempt, free.</span>
        <MedalTargets targets={targets} level={played ? MEDALS.filter((_, index) => state.challenge.score >= targets[index]).length : 0} />
        <span className="text-sm text-muted">
          {`Taking part pays ${config.challenge.tokens} tokens; each target beaten pays too. Practise in the arcade: today's pattern only appears in this attempt.`}
        </span>
        {result
          ? (
              <div className="flex flex-col items-center gap-1 border-2 border-primary p-3 text-center" role="status">
                <span className="font-display text-lg text-primary">{`You scored ${result.score}`}</span>
                {result.medals.length > 0 ? <span className="text-warning">{`${result.medals.map(medalName).join(', ')}!`}</span> : null}
                <span className="text-sm">
                  <RewardText reward={{ kind: 'tokens', amount: result.tokens }} />
                  {result.rewards.map((reward, index) => (
                    <span key={result.medals[index]}>
                      {' · '}
                      <RewardText reward={reward} />
                    </span>
                  ))}
                </span>
                {result.flagged ? <span className="text-sm text-muted">Your score is being checked before it goes on the board.</span> : null}
              </div>
            )
          : null}
        {played && !ticket
          ? (
              <span className="text-muted">
                {`Played: ${state.challenge.score}. A new challenge in `}
                <Countdown to={nextAt} offset={offset} />
              </span>
            )
          : (
              <button
                type="button"
                className="btn btn-accent min-h-12 font-display text-xs"
                disabled={start.isPending}
                onClick={() => (ticket ? setPlaying(true) : start.mutate(undefined, { onSuccess: () => setPlaying(true), onError }))}
              >
                {ticket ? 'Carry on' : 'Play today\'s challenge'}
              </button>
            )}
      </section>

      <section className="flex flex-col gap-2" aria-label="Leaderboards">
        <div className="flex gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'today'} className={`btn min-h-11 flex-1 ${tab === 'today' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('today')}>Today</button>
          <button type="button" role="tab" aria-selected={tab === 'week'} className={`btn min-h-11 flex-1 ${tab === 'week' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('week')}>This week</button>
        </div>
        {board.data
          ? tab === 'today'
            ? (
                <>
                  {board.data.you
                    ? <span>{board.data.you.held ? `Your ${board.data.you.score} is being checked.` : `You are ${board.data.you.rank} of ${board.data.players}.`}</span>
                    : null}
                  <Rows rows={board.data.daily} unit="pts" label="Today's board" />
                </>
              )
            : (
                <>
                  <span className="text-sm text-muted">Each day is worth up to 100 by where you finish; your best five days count. Top 3 win a Star pack and a crest badge, the top 10% a Star pack and gems, the top half gems and a pack, and three days played a pack.</span>
                  {board.data.yourWeek ? <span>{`You are ${board.data.yourWeek.rank} of ${board.data.weekPlayers} this week.`}</span> : null}
                  <Rows rows={board.data.weekly} unit="pts" label="This week's board" />
                </>
              )
          : board.isPending
            ? <LoadingState message="Loading the boards…" />
            : <span className="text-muted">The boards need a connection.</span>}
      </section>
    </div>
  )
}

export function ChallengeScreen() {
  const club = useClub()
  if (!club.data)
    return club.isPending ? <LoadingState message="Loading your club…" /> : <EmptyState title="No club yet" />
  return <Challenge game={club.data} />
}

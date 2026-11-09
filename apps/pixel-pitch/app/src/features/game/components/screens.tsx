import type { GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { SegmentedControl } from '@ld/mobile-ui'
import { EmptyState, LoadingState } from '@ld/ui'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useReplayMode } from '@/hooks/use-replay-mode'
import { useClub, useFixtures } from '../queries/use-game'
import { ClubHub } from './ClubHub'
import { LeagueScreen } from './LeagueScreen'
import { MatchReplay } from './MatchReplay'
import { MatchTextReplay } from './MatchTextReplay'
import { SquadScreen } from './SquadScreen'

/** The game screens run inside `ClubGate`, so the club is there (from the cache at least). */
function WithClub({ children }: { children: (game: GameResponse) => ReactNode }) {
  const club = useClub()
  return club.data ? children(club.data) : <LoadingState message="Opening the clubhouse…" />
}

export function ClubTab() {
  return <WithClub>{game => <ClubHub game={game} />}</WithClub>
}

export function SquadTab() {
  return <WithClub>{game => <SquadScreen game={game} />}</WithClub>
}

export function LeagueTab() {
  return <WithClub>{game => <LeagueScreen game={game} />}</WithClub>
}

export function MatchView() {
  const { no } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const club = useClub()
  const [mode, setMode] = useReplayMode()
  const fixtures = useFixtures(60)
  const fixture = fixtures.data?.find(entry => String(entry.no) === no)
    ?? club.data?.fixtures.find(entry => String(entry.no) === no)

  if (!fixture)
    return fixtures.isPending ? <LoadingState message="Finding the match…" /> : <EmptyState title="Match not found" />

  const clubName = club.data?.club.name ?? 'Your club'
  const onDone = () => navigate(search.get('debut') ? '/squad' : '/club', { replace: true })

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={[{ value: 'text', label: 'Match report' }, { value: 'pitch', label: 'Pitch' }]}
        value={mode}
        onChange={value => setMode(value === 'pitch' ? 'pitch' : 'text')}
      />
      {/* Switching restarts the match in the other view. */}
      {mode === 'pitch'
        ? <MatchReplay key="pitch" fixture={fixture} clubName={clubName} onDone={onDone} />
        : <MatchTextReplay key="text" fixture={fixture} clubName={clubName} onDone={onDone} />}
    </div>
  )
}

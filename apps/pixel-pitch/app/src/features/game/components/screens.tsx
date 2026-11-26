import type { FixtureResult, GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { BottomActions } from '@ld/mobile-ui'
import { EmptyState, LoadingState } from '@ld/ui'
import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { isCabinet } from '../lib/cabinets'
import { leagueName } from '../lib/club'
import { markWatched, wasWatched } from '../lib/watched'
import { useClub, useFixtures, useGameConfig } from '../queries/use-game'
import { AlbumScreen } from './AlbumScreen'
import { ArcadePlay } from './ArcadePlay'
import { ArcadeScreen } from './ArcadeScreen'
import { ClubHub } from './ClubHub'
import { GoalsScreen } from './GoalsScreen'
import { LeagueScreen } from './LeagueScreen'
import { MatchTextReplay } from './MatchTextReplay'
import { PacksScreen } from './PacksScreen'
import { PassScreen } from './PassScreen'
import { SquadScreen } from './SquadScreen'

/** The game screens run inside `ClubGate`, so the club is there (from the cache at least). */
function WithClub({ children }: { children: (game: GameResponse) => ReactNode }) {
  const club = useClub()
  return club.data ? children(club.data) : <LoadingState message="Opening the clubhouse…" />
}

export function ClubTab() {
  return <WithClub>{game => <ClubHub game={game} />}</WithClub>
}

export function GoalsTab() {
  return <WithClub>{game => <GoalsScreen game={game} />}</WithClub>
}

export function PassTab() {
  return <WithClub>{game => <PassScreen game={game} />}</WithClub>
}

export function AlbumTab() {
  return <WithClub>{game => <AlbumScreen game={game} />}</WithClub>
}

export function ArcadeTab() {
  return <WithClub>{game => <ArcadeScreen game={game} />}</WithClub>
}

export function ArcadeCabinetView() {
  const { cabinet } = useParams()
  return <WithClub>{game => (isCabinet(cabinet) ? <ArcadePlay game={game} cabinet={cabinet} /> : <EmptyState title="No such cabinet" />)}</WithClub>
}

export function PacksTab() {
  return <WithClub>{game => <PacksScreen game={game} />}</WithClub>
}

export function SquadTab() {
  return <WithClub>{game => <SquadScreen game={game} />}</WithClub>
}

export function LeagueTab() {
  return <WithClub>{game => <LeagueScreen game={game} />}</WithClub>
}

/** What kind of match this was, above the score. */
function matchLabel(fixture: FixtureResult) {
  return fixture.no < 0 ? 'Friendly · no league points' : `${leagueName(fixture.tier)} · Match ${fixture.no + 1}`
}

/** Before the club's very first match: what a match is here, and a clear button to start it. */
function FirstMatchIntro({ fixture, clubName, onStart }: { fixture: FixtureResult, clubName: string, onStart: () => void }) {
  const config = useGameConfig()
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 border-2 border-primary bg-base-100 p-4">
        <span className="font-display text-xs text-primary">Your first match</span>
        <span className="text-xl">{`${clubName} v ${fixture.rival.name}`}</span>
        <span className="text-lg">{`A friendly to get going. Football here is five-a-side: a keeper and four outfield players, ${config.match.minutes} minutes.`}</span>
        <span className="text-lg">Your starter squad is signed, picked and ready. Watch how they get on.</span>
        <span className="text-muted">League matches come next. They play themselves at kick-off, so set your lineup before then.</span>
      </section>
      <BottomActions>
        <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={onStart}>Kick off</button>
      </BottomActions>
    </div>
  )
}

export function MatchView() {
  const { no } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const club = useClub()
  const fixtures = useFixtures(60)
  const fixture = fixtures.data?.find(entry => String(entry.no) === no)
    ?? club.data?.fixtures.find(entry => String(entry.no) === no)
  const debut = Boolean(search.get('debut'))
  const [started, setStarted] = useState(!debut)
  // A match seen to the end before opens on its result: tapping an old result should not play it all again.
  const [ended, setEnded] = useState<string | null>(null)
  const end = useCallback(() => {
    if (!fixture)
      return
    markWatched(fixture)
    setEnded(`${fixture.no}:${fixture.kickoffAt}`)
  }, [fixture])

  if (!fixture)
    return fixtures.isPending ? <LoadingState message="Finding the match…" /> : <EmptyState title="Match not found" />

  const clubName = club.data?.club.name ?? 'Your club'
  const onDone = () => navigate(debut ? '/squad?first=1' : '/club', { replace: true })

  if (!started)
    return <FirstMatchIntro fixture={fixture} clubName={clubName} onStart={() => setStarted(true)} />

  const isEnded = ended === `${fixture.no}:${fixture.kickoffAt}` || wasWatched(fixture)

  return (
    <div className="flex flex-col gap-3">
      <span className="text-center text-muted">{matchLabel(fixture)}</span>
      <MatchTextReplay fixture={fixture} clubName={clubName} ended={isEnded} onEnd={end} />
      <BottomActions>
        {isEnded
          ? <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={onDone}>{debut ? 'Meet your squad' : 'Continue'}</button>
          : <button type="button" className="btn btn-outline min-h-12 w-full" onClick={end}>Skip to result</button>}
      </BottomActions>
    </div>
  )
}

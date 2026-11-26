import type { Chance, FixtureResult, GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { BottomActions } from '@ld/mobile-ui'
import { EmptyState, LoadingState } from '@ld/ui'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { isCabinet } from '../lib/cabinets'
import { kitOf, leagueName } from '../lib/club'
import { markWatched, wasWatched } from '../lib/watched'
import { useClub, useFixtures, useGameConfig } from '../queries/use-game'
import { AlbumScreen } from './AlbumScreen'
import { ArcadePlay } from './ArcadePlay'
import { ArcadeScreen } from './ArcadeScreen'
import { ClubHub } from './ClubHub'
import { GoalsScreen } from './GoalsScreen'
import { LeagueScreen } from './LeagueScreen'
import { LiveMoment } from './LiveMoment'
import { MatchTextReplay } from './MatchTextReplay'
import { PacksScreen } from './PacksScreen'
import { PassScreen } from './PassScreen'
import { Crest } from './sprites'
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
  // A scored live moment changes the match: its answer is shown at once, before the list is fetched again.
  const [changed, setChanged] = useState<FixtureResult | null>(null)
  const fixture = (changed && String(changed.no) === no ? changed : null)
    ?? fixtures.data?.find(entry => String(entry.no) === no)
    ?? club.data?.fixtures.find(entry => String(entry.no) === no)
  const debut = Boolean(search.get('debut'))
  const [started, setStarted] = useState(!debut)
  // Twice as fast, for a player who wants the gist. For this match only.
  const [speed, setSpeed] = useState(1)
  // A match seen to the end before opens on its result: tapping an old result should not play it all again.
  const [ended, setEnded] = useState<string | null>(null)
  const end = useCallback(() => {
    if (!fixture)
      return
    markWatched(fixture)
    setEnded(`${fixture.no}:${fixture.kickoffAt}`)
  }, [fixture])
  // The live moment for this match, if the player was there for it: kept here once the report reaches it, since
  // starting it takes it out of the club's state.
  const state = club.data?.club.state
  const offered = useMemo<Chance | null>(() => {
    if (!state || !fixture)
      return null
    if (state.live?.fixtureNo === fixture.no)
      return state.live
    return state.ticket?.kind === 'chance' && state.ticket.chance?.live && state.ticket.chance.fixtureNo === fixture.no ? state.ticket.chance : null
  }, [state, fixture])
  const [moment, setMoment] = useState<Chance | null>(null)
  const [momentDone, setMomentDone] = useState(false)
  const [holding, setHolding] = useState(false)
  const [jump, setJump] = useState(false)
  const hold = useCallback(() => {
    setHolding(true)
    setMoment(current => current ?? offered)
  }, [offered])

  if (!fixture)
    return fixtures.isPending ? <LoadingState message="Finding the match…" /> : <EmptyState title="Match not found" />

  const clubName = club.data?.club.name ?? 'Your club'
  const onDone = () => navigate(debut ? '/squad?first=1' : '/club', { replace: true })

  if (!started)
    return <FirstMatchIntro fixture={fixture} clubName={clubName} onStart={() => setStarted(true)} />

  const isEnded = ended === `${fixture.no}:${fixture.kickoffAt}` || (wasWatched(fixture) && !offered)
  const pending = momentDone || isEnded ? null : (moment ?? offered)

  const crest = club.data ? <Crest crest={club.data.club.crest} kit={kitOf(club.data)} scale={2} /> : null

  return (
    <div className="flex flex-col gap-3">
      <MatchTextReplay fixture={fixture} clubName={clubName} crest={crest} label={matchLabel(fixture)} ended={isEnded} onEnd={end} speed={speed} holdAt={pending?.minute ?? null} jump={jump} onHold={hold} />
      {pending && holding && club.data
        ? (
            <LiveMoment
              game={club.data}
              chance={pending}
              clubName={clubName}
              onDone={(result) => {
                setMoment(null)
                setMomentDone(true)
                setHolding(false)
                const after = result?.changedFixtures?.find(entry => entry.no === fixture.no)
                if (after) {
                  // Scored: the match is told again with the moment in it, from the result.
                  setChanged(after)
                  markWatched(after)
                  setEnded(`${after.no}:${after.kickoffAt}`)
                }
                else if (jump) {
                  // Missed on the way to full time: on to the end, as asked.
                  end()
                }
              }}
            />
          )
        : null}
      <BottomActions className="border-t-4! border-slate! bg-chrome!">
        {pending && holding
          ? <span className="block text-center text-muted">The match is waiting on you.</span>
          : isEnded
            ? <button type="button" className="btn btn-primary h-13 w-full text-lg" onClick={onDone}>{debut ? 'Meet your squad' : 'Continue'}</button>
            : (
                <div className="flex gap-2.5">
                  <button type="button" className="btn btn-outline h-13 w-18 text-lg" aria-pressed={speed === 2} aria-label={speed === 2 ? 'Speed: twice as fast' : 'Speed: normal'} onClick={() => setSpeed(speed === 2 ? 1 : 2)}>
                    {speed === 2 ? 'x2' : 'x1'}
                  </button>
                  <button type="button" className="btn btn-accent h-13 flex-1 text-lg" onClick={pending ? () => setJump(true) : end}>Skip to full time</button>
                </div>
              )}
      </BottomActions>
    </div>
  )
}

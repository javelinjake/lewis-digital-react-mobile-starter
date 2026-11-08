import { ErrorState, LoadingState } from '@ld/ui'
import { Navigate, Outlet } from 'react-router'
import { useClub } from '../queries/use-game'

/** Game screens need a club. Until the player has one, they go to onboarding. A cached club shows while syncing. */
export function ClubGate() {
  const club = useClub()
  if (club.data === undefined) {
    if (club.isError)
      return <ErrorState title="Could not reach the club" body="Check your connection and try again." />
    return <LoadingState message="Opening the clubhouse…" />
  }
  if (club.data === null)
    return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/**
 * Onboarding is only for players without a club. Once the club exists this sends them on: to the debut replay when
 * the club was just founded (only that answer carries the debut, match -1), otherwise to the hub.
 */
export function NoClubGate() {
  const club = useClub()
  if (club.data === undefined)
    return <LoadingState message="Opening the clubhouse…" />
  if (club.data) {
    const debut = club.data.fixtures.some(fixture => fixture.no < 0)
    return <Navigate to={debut ? '/match/-1?debut=1' : '/club'} replace />
  }
  return <Outlet />
}

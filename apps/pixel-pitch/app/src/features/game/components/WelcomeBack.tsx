import type { GameResponse, WelcomeBackEvent } from '@ld/pixel-pitch-core'
import { pendingStadiumCoins, pendingTrayTokens } from '@ld/pixel-pitch-core'
import { Link } from 'react-router'
import { art } from '../lib/art'
import { leagueName } from '../lib/club'
import { wasWatched } from '../lib/watched'
import { useGameConfig } from '../queries/use-game'
import { Icon } from './sprites'

/** What happened while the player was away. Shown once per sync that had news. */
export function WelcomeBack({ game, events, claims, claiming, onClaimAll, onClose }: { game: GameResponse, events: WelcomeBackEvent[], claims: number, claiming: boolean, onClaimAll: () => void, onClose: () => void }) {
  const config = useGameConfig()
  const { idle } = game.club.state
  const stadium = pendingStadiumCoins(idle, config, game.now)
  const trays = pendingTrayTokens(idle, config, game.now)
  // The league matches this sync played, newest first: each opens its report and stats.
  const played = game.fixtures.filter(fixture => fixture.no >= 0).sort((a, b) => b.kickoffAt - a.kickoffAt)
  const toWatch = played.find(fixture => !wasWatched(fixture))
  const shown = played.slice(0, 3)
  const waitingChances = game.club.state.chances.length
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Welcome back">
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-4 overflow-y-auto border-2 border-primary bg-base-100 p-5">
        <img src={art('text/banner_welcome_back.png')} alt="Welcome back" className="pixel h-auto w-48" />
        <ul className="flex w-full flex-col gap-2 text-lg">
          {stadium > 0
            ? (
                <li>
                  <Icon path="icons/currency_coin.png" />
                  {` ${stadium.toLocaleString('en-GB')} coins waiting in the stadium`}
                </li>
              )
            : null}
          {trays > 0
            ? (
                <li>
                  <Icon path="icons/currency_token.png" />
                  {` ${trays} tokens waiting in the arcade`}
                </li>
              )
            : null}
          {events.map((event) => {
            if (event.type === 'matches') {
              return (
                <li key={event.type} className="flex flex-col gap-1">
                  <span>
                    <Icon path="icons/ui_whistle.png" />
                    {' '}
                    {event.played}
                    {' '}
                    {event.played === 1 ? 'match' : 'matches'}
                    {' played: '}
                    {event.won}
                    W
                    {' '}
                    {event.drawn}
                    D
                    {' '}
                    {event.lost}
                    L
                  </span>
                  <span>
                    <Icon path="icons/currency_coin.png" />
                    {' +'}
                    {event.coins}
                    {' coins'}
                  </span>
                  {shown.length > 0
                    ? (
                        <ul className="flex flex-col" aria-label="Matches played">
                          {shown.map(fixture => (
                            <li key={fixture.no}>
                              <Link to={`/match/${fixture.no}`} onClick={onClose} className="flex min-h-11 items-center justify-between gap-2 border-b border-base-300">
                                <span className="min-w-0 truncate">{`v ${fixture.rival.name}`}</span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="tabular-nums">{`${fixture.goalsFor}–${fixture.goalsAgainst}`}</span>
                                  <span className={`font-display text-xs ${fixture.result === 'win' ? 'text-success' : fixture.result === 'loss' ? 'text-error' : 'text-warning'}`}>{fixture.result[0].toUpperCase()}</span>
                                  <span className="text-primary">›</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )
                    : null}
                  {played.length > shown.length ? <span className="text-muted">{`The other ${played.length - shown.length} are on the League screen.`}</span> : null}
                  {event.promotedTo ? <span className="text-primary">{`Promoted to ${leagueName(event.promotedTo)}!`}</span> : null}
                  {event.skipped > 0 ? <span className="text-muted">{`${event.skipped} older matches were not played while you were away.`}</span> : null}
                </li>
              )
            }
            if (event.type === 'packs') {
              return (
                <li key={event.type}>
                  <Icon path="icons/currency_pack.png" />
                  {` ${event.gained} ${event.gained === 1 ? 'pack' : 'packs'} on the shelf`}
                </li>
              )
            }
            if (event.type === 'chances')
              return null
            return (
              <li key={event.type}>
                <Icon path="icons/currency_gem.png" />
                {` +${event.amount} gems today`}
              </li>
            )
          })}
        </ul>
        {waitingChances > 0
          ? (
              <div className="flex w-full flex-col gap-2 border-2 border-accent p-3" aria-label="Big Chances waiting">
                <span className="text-lg">{`${waitingChances} Big ${waitingChances === 1 ? 'Chance' : 'Chances'} waiting`}</span>
                <span className="text-sm text-muted">From matches you missed that ended level or a goal down. Score one to move the result up.</span>
                <Link to="/chances" onClick={onClose} className="btn btn-accent min-h-12 font-display text-xs">Play</Link>
              </div>
            )
          : null}
        {toWatch
          ? <Link to={`/match/${toWatch.no}`} onClick={onClose} className="btn btn-primary min-h-12 w-full font-display text-xs">{played.length === 1 ? 'Watch the match' : 'Watch the latest match'}</Link>
          : null}
        {claims > 0
          ? <button type="button" className={`btn min-h-12 w-full font-display text-xs ${toWatch ? 'btn-outline' : 'btn-primary'}`} disabled={claiming} onClick={onClaimAll}>{claims === 1 ? 'Claim it' : `Claim all (${claims})`}</button>
          : null}
        <button type="button" className={`btn min-h-11 w-full ${toWatch || claims > 0 ? 'btn-ghost' : 'btn-primary font-display text-xs'}`} onClick={onClose}>{toWatch ? 'Not now' : 'Let\'s go'}</button>
      </div>
    </div>
  )
}

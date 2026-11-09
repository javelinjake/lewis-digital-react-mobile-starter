import type { GameResponse } from '@ld/pixel-pitch-core'
import { leagueTable } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { leagueName, nextRival, serverOffset } from '../lib/club'
import { useFixtures, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'

/** The table of six, progress to promotion, the next kick-off and recent results (each opens its replay). */
export function LeagueScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const fixtures = useFixtures(10)
  const { league } = game.club.state
  const table = leagueTable({ league, clubName: game.club.name, clubId: game.club.id, config })
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const progress = Math.min(1, league.points / config.league.pointsToPromote)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-primary">{leagueName(league.tier)}</h2>
          <span className="tabular-nums">{`${league.points}/${config.league.pointsToPromote} pts`}</span>
        </div>
        <div className="h-3 w-full bg-base-300" role="progressbar" aria-label="Points to promotion" aria-valuenow={league.points} aria-valuemin={0} aria-valuemax={config.league.pointsToPromote}>
          <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-muted">{`${config.league.pointsToPromote} points goes up. Every match pays, even a loss. No relegation.`}</span>
      </section>

      <table className="table table-sm text-lg">
        <thead>
          <tr className="text-muted">
            <th className="w-6">#</th>
            <th>Club</th>
            <th className="text-right">P</th>
            <th className="text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, index) => (
            <tr key={row.name} className={row.isClub ? 'bg-base-100 text-primary' : ''}>
              <td>{index + 1}</td>
              <td>{row.name}</td>
              <td className="text-right tabular-nums">{row.played}</td>
              <td className="text-right tabular-nums">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex items-center justify-between border-2 border-slate bg-base-100 p-3">
        <span>{`Next: v ${nextRival(game, config).name}`}</span>
        <span className="font-display text-xs text-primary"><Countdown to={league.nextKickoffAt} offset={offset} /></span>
      </section>

      <section className="flex flex-col gap-1">
        <h2>Results</h2>
        {fixtures.data?.length
          ? (
              <ul className="flex flex-col">
                {fixtures.data.map(fixture => (
                  <li key={fixture.no}>
                    <Link to={`/match/${fixture.no}`} className="flex min-h-11 items-center justify-between border-b border-base-300 py-1">
                      <span>{`${fixture.no < 0 ? 'Friendly' : `Match ${fixture.no + 1}`} v ${fixture.rival.name}`}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{`${fixture.goalsFor}–${fixture.goalsAgainst}`}</span>
                        <span className={`w-6 text-center font-display text-xs ${fixture.result === 'win' ? 'text-success' : fixture.result === 'loss' ? 'text-error' : 'text-warning'}`}>{fixture.result[0].toUpperCase()}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          : <span className="text-muted">{fixtures.isPending ? 'Loading results…' : 'No league matches yet. The first kicks off soon.'}</span>}
      </section>
    </div>
  )
}

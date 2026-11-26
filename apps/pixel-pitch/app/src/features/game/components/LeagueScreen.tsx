import type { GameResponse } from '@ld/pixel-pitch-core'
import { leagueTable } from '@ld/pixel-pitch-core'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { nextRival, serverOffset } from '../lib/club'
import { useFixtures, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'

const RESULT_STYLE = {
  win: 'bg-success text-success-content',
  draw: 'bg-warning text-warning-content',
  loss: 'bg-error text-error-content',
} as const
const RESULT_WORD = { win: 'won', draw: 'drawn', loss: 'lost' } as const

/**
 * The league: progress to promotion in blocks, the table of six with the club picked out, the next match with a way
 * to the lineup, and recent results (each opens its report).
 */
export function LeagueScreen({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const fixtures = useFixtures(10)
  const { league } = game.club.state
  const table = leagueTable({ league, clubName: game.club.name, clubId: game.club.id, config })
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const target = config.league.pointsToPromote
  const blocks = 10
  const filled = Math.min(blocks, Math.floor((league.points / target) * blocks))

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-2 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Promotion">
        <div className="flex items-baseline justify-between">
          <span className="pp-label">Promotion</span>
          <span className="font-bold text-primary tabular-nums">{`${league.points} / ${target} pts`}</span>
        </div>
        <div className="grid grid-cols-10 gap-1" role="progressbar" aria-label="Points to promotion" aria-valuenow={league.points} aria-valuemin={0} aria-valuemax={target}>
          {Array.from({ length: blocks }, (_, block) => (
            <span key={block} className={`h-3 ${block < filled ? 'bg-primary' : 'bg-base-200 shadow-[inset_0_0_0_1px_var(--color-slate)]'}`} />
          ))}
        </div>
        <span className="text-sm text-muted">{`Win ${config.league.winPoints} · Draw ${config.league.drawPoints} · Loss ${config.league.lossPoints}. Every match pays coins, even a loss.`}</span>
      </section>

      <section className="bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="League table">
        <table className="w-full text-left">
          <thead>
            <tr className="pp-label">
              <th className="w-9 py-2 pl-3 font-semibold">#</th>
              <th className="py-2 font-semibold">Club</th>
              <th className="w-10 py-2 text-right font-semibold">P</th>
              <th className="w-14 py-2 pr-3 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => (
              <tr
                key={row.name}
                className={row.isClub ? 'bg-raised font-bold text-primary shadow-[inset_4px_0_0_var(--color-primary)]' : 'border-t-2 border-slate'}
              >
                <td className="py-2.5 pl-3 tabular-nums">{index + 1}</td>
                <td className="truncate py-2.5">{row.name}</td>
                <td className="py-2.5 text-right tabular-nums">{row.played}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex items-center gap-3 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Next match">
        <div className="min-w-0 flex-1">
          <div className="pp-label">
            {'Next · '}
            <Countdown to={league.nextKickoffAt} offset={offset} />
          </div>
          <div className="truncate font-bold">{`v ${nextRival(game, config).name}`}</div>
        </div>
        <Link to="/squad" className="btn btn-primary min-h-11 shrink-0 px-4">Set lineup</Link>
      </section>

      <section className="flex flex-col gap-2" aria-label="Results">
        <span className="pp-label">Results</span>
        {fixtures.data?.length
          ? (
              <ul className="flex flex-col gap-1.5">
                {fixtures.data.map(fixture => (
                  <li key={fixture.no}>
                    <Link to={`/match/${fixture.no}`} className="flex min-h-12 items-center gap-2.5 bg-base-100 px-3 shadow-[inset_0_0_0_2px_var(--color-slate)]">
                      <span className="min-w-0 flex-1 truncate">{`${fixture.no < 0 ? 'Friendly' : `Match ${fixture.no + 1}`} v ${fixture.rival.name}`}</span>
                      <span className="font-bold tabular-nums">{`${fixture.goalsFor}–${fixture.goalsAgainst}`}</span>
                      <span className={`w-7 text-center font-bold ${RESULT_STYLE[fixture.result]}`} aria-hidden="true">{fixture.result[0].toUpperCase()}</span>
                      <span className="sr-only">{`, ${RESULT_WORD[fixture.result]}`}</span>
                      <span className="text-muted" aria-hidden="true">›</span>
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

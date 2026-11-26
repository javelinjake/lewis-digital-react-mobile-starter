import type { GameResponse } from '@ld/pixel-pitch-core'
import type { ReactNode } from 'react'
import { BottomSheet } from '@ld/mobile-ui'
import { matchOdds, paidFriendliesLeft } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { currentScore, kitOf, nextRival, rivalSide, serverOffset } from '../lib/club'
import { useServerNow } from '../lib/server-clock'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { Countdown } from './Countdown'
import { Crest } from './sprites'
import { WarmupPanel } from './WarmupCard'

const percent = (value: number) => `${Math.round(value * 100)}%`

/** A rival's shield: the league's sides have no crest art, so a plain one in colours picked from their place. */
const RIVAL_COLOURS = [['#3b6fd8', '#ffd23f'], ['#7a3fd6', '#f4f4f4'], ['#e08a2e', '#15141c'], ['#2e9e8a', '#f4f4f4'], ['#c43a5a', '#f4f4f4']] as const
function RivalShield({ index }: { index: number }) {
  const [top, bottom] = RIVAL_COLOURS[index % RIVAL_COLOURS.length]
  return (
    <svg viewBox="0 0 12 14" width={38} height={44} shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#0b1028" d="M0 0h12v9h-1v2H9v2H7v1H5v-1H3v-2H1V9H0z" />
      <path fill={top} d="M1 1h10v5H1z" />
      <path fill={bottom} d="M1 6h10v2h-1v2H8v2H4v-2H2V8H1z" />
    </svg>
  )
}

function Side({ crest, name, rating, ours }: { crest: ReactNode, name: string, rating: number, ours: boolean }) {
  return (
    <div className="flex w-26 flex-col items-center gap-0.5 text-center">
      {crest}
      <span className="w-full truncate font-semibold text-white">{name}</span>
      <span className={`px-1.5 text-sm font-bold ${ours ? 'bg-primary text-primary-content' : 'bg-base-200 text-white'}`} aria-label={`rated ${rating}`}>{rating}</span>
    </div>
  )
}

/**
 * The next league match, the biggest thing on the club screen: who, when, the chances with the lineup as it is, and
 * the two things to do before it (set the lineup, warm up). A friendly can be played now, while you wait.
 */
export function MatchHero({ game, onKickoff }: { game: GameResponse, onKickoff: () => void }) {
  const config = useGameConfig()
  const toast = useToast()
  const navigate = useNavigate()
  const { lookup } = useCatalogue()
  const now = useServerNow(game)
  const offset = useMemo(() => serverOffset(game, Date.now()), [game])
  const [warming, setWarming] = useState(false)
  const friendly = useGameAction(() => gameApi.playFriendly())
  const { state } = game.club
  const rival = nextRival(game, config)
  const score = currentScore(game, lookup, config)
  const warmup = state.league.warmupBonus
  const tried = state.warmupTriedFor === state.league.fixtureNo
  const odds = matchOdds({ formation: state.formation, att: score.att, def: score.def }, rivalSide(rival), config, warmup)
  const paidLeft = paidFriendliesLeft(state, config, now)
  const best = Math.round(config.match.warmupGold * 100)

  return (
    <section className="pp-grass flex flex-col gap-3 p-3.5 shadow-[inset_0_0_0_3px_var(--color-primary)]" aria-label="Next match">
      <div className="flex justify-between text-xs font-semibold tracking-wider text-white uppercase">
        <span>{`Matchday ${state.league.fixtureNo + 1} · League`}</span>
        <span>Kick-off in</span>
      </div>
      <div className="flex items-center justify-between">
        <Side ours name={game.club.name} rating={score.overall} crest={<Crest crest={game.club.crest} kit={kitOf(game)} scale={2} />} />
        <div className="text-center">
          <div className="text-3xl leading-none font-bold whitespace-nowrap text-white [text-shadow:3px_3px_0_#0b1028]">
            <Countdown to={state.league.nextKickoffAt} offset={offset} onDone={onKickoff} />
          </div>
        </div>
        <Side ours={false} name={rival.name} rating={rival.rating} crest={<RivalShield index={rival.index} />} />
      </div>

      <div>
        <div className="flex h-3 gap-0.5 shadow-[0_0_0_2px_#0b1028]" aria-hidden="true">
          <span className="bg-success" style={{ width: percent(odds.win) }} />
          <span className="bg-warning" style={{ width: percent(odds.draw) }} />
          <span className="bg-error" style={{ width: percent(odds.loss) }} />
        </div>
        <div className="mt-1 flex justify-between text-sm font-semibold text-white">
          <span>{`Win ${percent(odds.win)}`}</span>
          <span>{`Draw ${percent(odds.draw)}`}</span>
          <span>{`Loss ${percent(odds.loss)}`}</span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <Link to="/squad" className="btn btn-primary h-13 flex-2 text-lg">Set lineup</Link>
        <button
          type="button"
          className={`btn h-13 flex-1 flex-col gap-0 text-sm leading-tight ${tried ? 'btn-success' : 'btn-accent'}`}
          aria-label={tried ? `Warmed up: +${Math.round(warmup * 100)}% attack` : 'Warm up'}
          onClick={() => setWarming(true)}
        >
          {tried
            ? (
                <>
                  <span>Warmed up</span>
                  <span>{`+${Math.round(warmup * 100)}% ATK`}</span>
                </>
              )
            : (
                <>
                  <span>Warm up</span>
                  <span>{`+${best}% ATK`}</span>
                </>
              )}
        </button>
      </div>

      <button
        type="button"
        className="btn btn-outline min-h-11 justify-between"
        disabled={friendly.isPending}
        onClick={() => friendly.mutate(undefined, {
          onSuccess: response => navigate(`/match/${response.fixture.no}`),
          onError: error => toast.push(formatError(error), 'error'),
        })}
      >
        <span>{friendly.isPending ? 'Kicking off…' : 'Play a friendly now'}</span>
        <span className="text-sm font-semibold text-muted">
          {paidLeft > 0 ? `${config.friendly.lossCoins}–${config.friendly.winCoins} coins · ${paidLeft} left` : 'For fun · no coins today'}
        </span>
      </button>
      <span className="-mt-1 text-center text-sm text-white">The league match plays itself at kick-off with your lineup.</span>

      <BottomSheet open={warming} title="Warm-up kick" onClose={() => setWarming(false)}>
        <WarmupPanel game={game} onDone={() => setWarming(false)} />
      </BottomSheet>
    </section>
  )
}

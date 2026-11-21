import type { ComponentType } from 'react'
import type { LabGame, LabGameId } from '../lib/games'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useLabBest } from '../hooks/use-lab-best'
import { LAB_GAMES } from '../lib/games'
import { ConeGame } from './ConeGame'
import { DribbleGame } from './DribbleGame'
import { KeeperGame } from './KeeperGame'
import { PassGame } from './PassGame'
import { TargetGame } from './TargetGame'

const GAMES: Record<LabGameId, ComponentType<{ seed: string, onFinish: (score: number) => void }>> = {
  keeper: KeeperGame,
  pass: PassGame,
  dribble: DribbleGame,
  targets: TargetGame,
  cones: ConeGame,
}

const scoreText = (score: number, game: LabGame) => (game.max === null ? String(score) : `${score} / ${game.max}`)

/** The list of prototype games. They cost no energy and pay nothing: they are here to find out which are fun. */
export function LabList() {
  const { bests } = useLabBest()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">Prototype mini-games to try. They cost no energy and pay no rewards. Play them, and say which should go in the arcade.</p>
      {LAB_GAMES.map(game => (
        <section key={game.id} className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label={game.name}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-primary">{game.name}</h2>
            <span className="bg-base-300 px-2 text-muted">{game.skill}</span>
          </div>
          <span className="text-muted">{game.blurb}</span>
          <span className="text-lg tabular-nums">{bests[game.id] ? `Best: ${scoreText(bests[game.id]!, game)}` : 'Not played yet'}</span>
          <Link to={`/lab/${game.id}`} className="btn btn-primary min-h-12 font-display text-xs">Play</Link>
        </section>
      ))}
    </div>
  )
}

type Phase = 'intro' | 'playing' | 'result'

/** One test game: how to play, the game, then the score against your best, with another go one tap away. */
export function LabPlay({ game }: { game: LabGame }) {
  const { bests, record } = useLabBest()
  const [phase, setPhase] = useState<Phase>('intro')
  const [seed, setSeed] = useState('')
  const [result, setResult] = useState<{ score: number, newBest: boolean, previous: number } | null>(null)
  const Game = GAMES[game.id]

  const start = () => {
    setSeed(`${game.id}:${Date.now()}`)
    setPhase('playing')
  }
  const finish = useCallback((score: number) => {
    const previous = bests[game.id] ?? 0
    setResult({ score, previous, newBest: record(game.id, score) })
    setPhase('result')
  }, [bests, game.id, record])

  if (phase === 'playing') {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-primary">{game.name}</h2>
        <Game key={seed} seed={seed} onFinish={finish} />
      </div>
    )
  }

  if (phase === 'result' && result) {
    const verdict = result.newBest
      ? (result.previous > 0 ? 'New best!' : 'First score on the board!')
      : result.score === result.previous && result.score > 0
        ? 'Level with your best.'
        : result.previous > 0 ? `${result.previous - result.score} off your best of ${result.previous}.` : 'Nothing on the board yet.'
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-3 border-2 border-primary bg-base-100 p-4" aria-label="Result">
          <h2 className="text-primary">{game.name}</h2>
          <span className="font-display text-lg tabular-nums">{scoreText(result.score, game)}</span>
          <span className={result.newBest ? 'text-xl text-success' : 'text-lg text-muted'} role="status">{verdict}</span>
        </div>
        <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={start}>Play again</button>
        <Link to="/lab" className="btn btn-ghost min-h-11 w-full">Back to the test games</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-primary">{game.name}</h2>
      <span className="text-lg">{game.how}</span>
      <span className="text-lg tabular-nums">{bests[game.id] ? `Your best: ${scoreText(bests[game.id]!, game)}` : 'Not played yet'}</span>
      <button type="button" className="btn btn-primary min-h-12 font-display text-xs" onClick={start}>Start</button>
      <Link to="/lab" className="btn btn-ghost min-h-11">Back</Link>
    </div>
  )
}

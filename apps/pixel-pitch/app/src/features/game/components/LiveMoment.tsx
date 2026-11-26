import type { Chance, ChanceResult, GameResponse } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useEffect, useRef, useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { CHANCE_NAME, chanceHow } from '../lib/chances'
import { useGameAction } from '../mutations/use-game-action'
import { useGameConfig } from '../queries/use-game'
import { ChancePlay } from './ChancePlay'

/**
 * The live moment, when the report stops at it: what it is, a countdown, and Take it or Let it play. No answer in
 * time counts as a miss, as does Let it play. Taking it plays the one round of its game.
 */
export function LiveMoment({ game, chance, clubName, onDone }: { game: GameResponse, chance: Chance, clubName: string, onDone: (result: (GameResponse & ChanceResult) | null) => void }) {
  const config = useGameConfig()
  const toast = useToast()
  const [taking, setTaking] = useState(game.club.state.ticket?.chance?.fixtureNo === chance.fixtureNo)
  const [left, setLeft] = useState(config.moments.decideSeconds)
  const box = useRef<HTMLDivElement>(null)
  // The report above can be long: bring the moment, and then its game, into view.
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [taking])
  const skip = useGameAction(() => gameApi.skipChance(chance.fixtureNo))
  const letGo = () => skip.mutate(undefined, {
    onSuccess: () => onDone(null),
    onError: (error) => {
      toast.push(formatError(error), 'error')
      onDone(null)
    },
  })

  useEffect(() => {
    if (taking || skip.isPending)
      return
    if (left <= 0) {
      letGo()
      return
    }
    const timer = setTimeout(() => setLeft(seconds => seconds - 1), 1000)
    return () => clearTimeout(timer)
  })

  if (taking)
    return <div ref={box}><ChancePlay game={game} chance={chance} started onDone={onDone} /></div>

  const setup = chance.kind === 'penalty'
    ? `${chance.minute}'. Penalty to ${clubName}!`
    : chance.kind === 'freekick'
      ? `${chance.minute}'. Free kick to ${clubName}, on the edge of the box.`
      : `${chance.minute}'. They are clean through on your goal.`
  return (
    <section ref={box} className="flex flex-col gap-3 bg-raised p-3 shadow-[inset_0_0_0_3px_var(--color-accent)]" aria-label="Live moment">
      <span className="font-display text-sm text-accent">{`Your moment: ${CHANCE_NAME[chance.kind]}`}</span>
      <span className="text-lg">{setup}</span>
      <span>{chance.kind === 'save' ? 'Keep it out and their goal never happens.' : `Score and it is a goal for ${clubName}.`}</span>
      <span className="text-sm text-muted">{chanceHow(chance.kind, config.moments.freeKickPoints)}</span>
      <div className="flex gap-2.5">
        <button type="button" className="btn btn-ghost min-h-12 flex-1" disabled={skip.isPending} onClick={letGo}>Let it play</button>
        <button type="button" className="btn btn-accent min-h-12 flex-1 font-display text-xs" disabled={skip.isPending} onClick={() => setTaking(true)}>
          {`Take it · ${Math.max(0, left)}s`}
        </button>
      </div>
    </section>
  )
}

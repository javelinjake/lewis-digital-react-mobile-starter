import type { GameResponse, Player } from '@ld/pixel-pitch-core'
import type { CardTag } from './PlayerCard'
import { benchCount, lineupForMatch, toFielded, upgradeDelta } from '@ld/pixel-pitch-core'
import { useReducedEffects } from '@ld/react-utils'
import { useToast } from '@ld/ui'
import { useMemo, useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { art } from '../lib/art'
import { kitOf } from '../lib/club'
import { packArt, RARITY_LABEL } from '../lib/packs'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { CardBack, PlayerCard } from './PlayerCard'
import { Icon } from './sprites'

type Phase = 'rip' | 'reveal' | 'decide'

const STING_COLOUR: Record<Player['rarity'], string> = {
  grassroots: '#9aa3b5',
  semipro: '#3fa34d',
  pro: '#3f7fd6',
  star: '#f2a33a',
  legend: '#e2483d',
}

/**
 * The pack opening: tear the pack, turn each card over, then sign or sell. The three players were rolled by the
 * server when the pack was opened, so leaving halfway only pauses it: the pack is still waiting next time.
 */
export function PackReveal({ game, onClose }: { game: GameResponse, onClose: () => void }) {
  const config = useGameConfig()
  const { lookup } = useCatalogue()
  const toast = useToast()
  const reduced = useReducedEffects()
  const pending = game.club.state.pendingPack
  const [phase, setPhase] = useState<Phase>('rip')
  const [tearing, setTearing] = useState(false)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const decide = useGameAction((decisions: Array<'sign' | 'sell'>) => gameApi.decidePack(decisions))

  const players = useMemo(() => (pending?.playerIds ?? []).flatMap(id => lookup(id) ?? []), [pending, lookup])
  const kit = kitOf(game)
  const { state } = game.club

  // What each card would do for the lineup, and whether the club already has the player.
  const tags = useMemo<CardTag[]>(() => {
    const lineup = lineupForMatch(state, game.cards, lookup, config)
    return players.map((player) => {
      const fielded = toFielded({ id: 'candidate', playerId: player.id, stars: 1, trained: 0 }, player, config)
      if (upgradeDelta(lineup.formation, lineup.players, fielded).delta > 0.05)
        return 'upgrade'
      return game.cards.some(card => card.playerId === player.id) ? 'dupe' : state.album.collected.includes(player.id) ? null : 'new'
    })
  }, [players, state, game.cards, lookup, config])

  const room = config.cards.benchSize - benchCount(game.cards, state.lineup)
  const [choices, setChoices] = useState<Array<'sign' | 'sell'> | null>(null)
  const decisions = choices ?? players.map((_, position) => (position < room ? 'sign' : 'sell'))
  const signing = decisions.filter(choice => choice === 'sign').length
  const sellTotal = decisions.reduce((sum, choice, position) => sum + (choice === 'sell' ? config.cards.sellValue[players[position].rarity] : 0), 0)
  const overfull = signing > room

  if (!pending || players.length === 0)
    return null

  const player = players[index]
  const tear = () => {
    if (reduced) {
      setPhase('reveal')
      return
    }
    setTearing(true)
    setTimeout(() => setPhase('reveal'), 600)
  }
  const next = () => {
    if (index + 1 < players.length) {
      setIndex(index + 1)
      setFlipped(false)
    }
    else {
      setPhase('decide')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center overflow-y-auto bg-base-300 p-4" role="dialog" aria-modal="true" aria-label="Open pack" style={{ paddingTop: 'calc(1rem + var(--safe-top))', paddingBottom: 'calc(1rem + var(--safe-bottom))' }}>
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4">
        {phase === 'rip'
          ? (
              <>
                <h2 className="text-primary">{pending.source === 'star' ? 'Star pack' : pending.source === 'arcade' ? 'Arcade pack' : 'Pack'}</h2>
                <button type="button" className="relative" style={{ width: 40 * 5, height: 52 * 5, animation: tearing || reduced ? 'none' : 'pp-shake 700ms steps(4) infinite' }} onClick={tear} aria-label="Tear open the pack">
                  <img src={art(packArt(state.league.tier, pending.source).replace('.png', '_bottom.png'))} alt="" className="pixel absolute left-0 bottom-0" style={{ width: 40 * 5, height: 42 * 5, animation: tearing ? 'pp-tear-bottom 500ms steps(5) forwards' : undefined }} />
                  <img src={art(packArt(state.league.tier, pending.source).replace('.png', '_top.png'))} alt="" className="pixel absolute left-0 top-0" style={{ width: 40 * 5, height: 10 * 5, animation: tearing ? 'pp-tear-top 500ms steps(5) forwards' : undefined }} />
                </button>
                <span className="text-muted">Tap the pack to open it</span>
              </>
            )
          : null}

        {phase === 'reveal'
          ? (
              <>
                <span className="text-muted tabular-nums">{`Player ${index + 1} of ${players.length}`}</span>
                <button type="button" className="pp-flip" onClick={() => (flipped ? next() : setFlipped(true))} aria-label={flipped ? 'Next player' : 'Turn the card over'}>
                  <div className="pp-flip-inner" data-flipped={flipped} style={reduced ? { transition: 'none' } : undefined}>
                    <div className="pp-flip-face"><CardBack scale={4} /></div>
                    <div className="pp-flip-face pp-flip-back"><PlayerCard player={player} rating={toFielded({ id: 'x', playerId: player.id, stars: 1, trained: 0 }, player, config).rating} kit={kit} scale={4} tag={tags[index]} /></div>
                  </div>
                </button>
                {flipped
                  ? (
                      <div className="flex flex-col items-center gap-1" style={{ animation: reduced ? undefined : 'pp-pop 250ms steps(3)' }}>
                        <span className="font-display text-xs" style={{ color: STING_COLOUR[player.rarity] }}>{RARITY_LABEL[player.rarity].toUpperCase()}</span>
                        <span className="text-xl">{player.name}</span>
                        {pending.guaranteed[index] ? <span className="text-muted">The Star guarantee</span> : null}
                        <button type="button" className="btn btn-primary mt-2 min-h-11 w-48 font-display text-xs" onClick={next}>{index + 1 < players.length ? 'Next' : 'Sign or sell'}</button>
                      </div>
                    )
                  : <span className="text-muted">Tap the card to turn it over</span>}
              </>
            )
          : null}

        {phase === 'decide'
          ? (
              <>
                <h2>Sign or sell</h2>
                <ul className="flex w-full justify-center gap-2">
                  {players.map((entry, position) => (
                    <li key={entry.id} className="flex flex-col items-center gap-2">
                      <PlayerCard player={entry} rating={toFielded({ id: 'x', playerId: entry.id, stars: 1, trained: 0 }, entry, config).rating} kit={kit} scale={2} tag={tags[position]} />
                      <div className="join" role="radiogroup" aria-label={`${entry.name}: sign or sell`}>
                        {(['sign', 'sell'] as const).map(choice => (
                          <button
                            key={choice}
                            type="button"
                            role="radio"
                            aria-checked={decisions[position] === choice}
                            className={`btn join-item btn-sm min-h-11 px-2 ${decisions[position] === choice ? (choice === 'sign' ? 'btn-primary' : 'btn-secondary') : 'btn-ghost'}`}
                            onClick={() => setChoices(decisions.map((current, at) => (at === position ? choice : current)))}
                          >
                            {choice === 'sign' ? 'Sign' : `Sell ${config.cards.sellValue[entry.rarity]}`}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col items-center gap-1 text-lg">
                  <span>{`Bench after signing: ${benchCount(game.cards, state.lineup) + signing}/${config.cards.benchSize}`}</span>
                  <span>
                    <Icon path="icons/currency_coin.png" />
                    {` +${sellTotal} coins from sales`}
                  </span>
                  {overfull ? <span className="text-error" role="alert">{`Your bench has room for ${Math.max(0, room)} more. Sell the rest.`}</span> : null}
                </div>
                <button
                  type="button"
                  className="btn btn-primary min-h-12 w-full font-display text-xs"
                  disabled={overfull || decide.isPending}
                  onClick={() => decide.mutate(decisions, { onSuccess: onClose, onError: error => toast.push(formatError(error), 'error') })}
                >
                  {decide.isPending ? 'Saving…' : 'Done'}
                </button>
              </>
            )
          : null}
      </div>
      {phase !== 'decide' ? <button type="button" className="btn btn-ghost min-h-11" onClick={onClose}>Later</button> : null}
    </div>
  )
}

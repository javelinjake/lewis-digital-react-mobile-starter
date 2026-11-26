import type { GameResponse, PackSource, Player } from '@ld/pixel-pitch-core'
import type { CardTag } from './PlayerCard'
import { benchCount, benchLimit, lineupForMatch, toFielded, upgradeDelta } from '@ld/pixel-pitch-core'
import { useReducedEffects } from '@ld/react-utils'
import { useToast } from '@ld/ui'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { play } from '@/lib/sound/sound'
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
 *
 * It opens the moment the player asks for a pack (`source`), with the pack wobbling while the server rolls it, so the
 * tap gets an answer at once. The cards are drawn out of sight while the pack is still shut, so each face is ready
 * when it turns over. Motion is eased, not stepped, and only the card moves between players.
 */
export function PackReveal({ game, source, quick = false, onClose, onNext }: { game: GameResponse, source?: PackSource, quick?: boolean, onClose: () => void, onNext?: () => void }) {
  const config = useGameConfig()
  const { lookup } = useCatalogue()
  const toast = useToast()
  const reduced = useReducedEffects()
  const pending = game.club.state.pendingPack
  // Open all: every card face up at once, then straight on to the next pack.
  const [phase, setPhase] = useState<Phase>(quick ? 'decide' : 'rip')
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

  // Your best player now in each new player's position, to compare against.
  const bestAt = useMemo(() => players.map((player) => {
    let best: { name: string, rating: number } | null = null
    for (const card of game.cards) {
      const owned = lookup(card.playerId)
      if (!owned || owned.position !== player.position)
        continue
      const rating = toFielded(card, owned, config).rating
      if (!best || rating > best.rating)
        best = { name: owned.name, rating }
    }
    return best
  }), [players, game.cards, lookup, config])

  const bench = benchLimit(state, config)
  const room = bench - benchCount(game.cards, state.lineup)
  const [choices, setChoices] = useState<Array<'sign' | 'sell'> | null>(null)
  // Keep everyone there is room for. Duplicates are kept too: three copies merge into a better card. When the bench is
  // too full for all of them, the ones that would help least (lowest rated, not an upgrade or new) are sold.
  const defaults = useMemo(() => {
    const priority = players
      .map((player, position) => ({ position, keep: (tags[position] === 'upgrade' ? 2 : tags[position] ? 1 : 0) * 1000 + toFielded({ id: 'x', playerId: player.id, stars: 1, trained: 0 }, player, config).rating }))
      .sort((a, b) => b.keep - a.keep)
    const kept = new Set(priority.slice(0, Math.max(0, room)).map(entry => entry.position))
    return players.map((_, position): 'sign' | 'sell' => (kept.has(position) ? 'sign' : 'sell'))
  }, [players, tags, room, config])
  const decisions = choices ?? defaults
  const signing = decisions.filter(choice => choice === 'sign').length
  const sellTotal = decisions.reduce((sum, choice, position) => sum + (choice === 'sell' ? config.cards.sellValue[players[position].rarity] : 0), 0)
  const overfull = signing > room
  /** Packs still to open once this one is decided. */
  const more = state.idle.shelfPacks + state.starPacks

  const ready = Boolean(pending) && players.length > 0
  // Until the server has rolled the pack (or after deciding, while the next one is on its way), the pack waits shut.
  const shown: Phase = ready ? phase : 'rip'
  const packSource = pending?.source ?? source ?? 'shelf'
  const player = players[index]
  const tear = () => {
    if (!ready)
      return
    if (reduced) {
      setPhase('reveal')
      return
    }
    play('pack_rip')
    setTearing(true)
    setTimeout(() => setPhase('reveal'), 380)
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
    <div className="fixed inset-0 z-40 flex flex-col items-center bg-base-300" role="dialog" aria-modal="true" aria-label="Open pack" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <div className="flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4">
        {/* The three cards, drawn out of sight while the pack is shut, so each face is ready when it turns. */}
        {ready && shown === 'rip'
          ? (
              <div className="pointer-events-none fixed -left-[9999px] opacity-0" aria-hidden="true">
                {players.map(entry => <PlayerCard key={entry.id} player={entry} rating={toFielded({ id: 'x', playerId: entry.id, stars: 1, trained: 0 }, entry, config).rating} kit={kit} scale={4} />)}
                <CardBack scale={4} />
              </div>
            )
          : null}

        {shown === 'rip'
          ? (
              <>
                <h2 className="text-primary">{packSource === 'star' ? 'Star pack' : packSource === 'arcade' ? 'Arcade pack' : 'Pack'}</h2>
                <button
                  type="button"
                  className="relative"
                  style={{ width: 40 * 5, height: 52 * 5 }}
                  onClick={tear}
                  disabled={!ready}
                  aria-label="Tear open the pack"
                >
                  {/* The picture wobbles, not the button, so the button stays still to tap. */}
                  <span className="absolute inset-0" style={{ animation: tearing || reduced ? 'none' : `pp-wobble ${ready ? '1.4s' : '0.6s'} ease-in-out infinite` }}>
                    <img src={art(packArt(state.league.tier, packSource).replace('.png', '_bottom.png'))} alt="" className="pixel absolute left-0 bottom-0" style={{ width: 40 * 5, height: 42 * 5, animation: tearing ? 'pp-tear-bottom 380ms cubic-bezier(.4,0,1,1) forwards' : undefined }} />
                    <img src={art(packArt(state.league.tier, packSource).replace('.png', '_top.png'))} alt="" className="pixel absolute left-0 top-0" style={{ width: 40 * 5, height: 10 * 5, animation: tearing ? 'pp-tear-top 380ms cubic-bezier(.2,.8,.3,1) forwards' : undefined }} />
                  </span>
                </button>
                <span className="text-muted">{ready ? 'Tap the pack to open it' : 'Opening…'}</span>
              </>
            )
          : null}

        {shown === 'reveal'
          ? (
              <>
                <span className="text-muted tabular-nums">{`Player ${index + 1} of ${players.length}`}</span>
                <button
                  key={index}
                  type="button"
                  className="pp-flip"
                  style={{ animation: reduced ? undefined : 'pp-card-in 300ms cubic-bezier(.2,.8,.2,1)' }}
                  onClick={() => {
                    if (flipped) {
                      next()
                      return
                    }
                    play('card_flip')
                    play(player.rarity === 'legend' ? 'reveal_legend' : player.rarity === 'star' ? 'reveal_star' : player.rarity === 'pro' ? 'reveal_pro' : 'reveal_common', 0.8)
                    setFlipped(true)
                  }}
                  aria-label={flipped ? 'Next player' : 'Turn the card over'}
                >
                  <div className="pp-flip-inner" data-flipped={flipped} style={reduced ? { transition: 'none' } : undefined}>
                    <div className="pp-flip-face"><CardBack scale={4} /></div>
                    <div className="pp-flip-face pp-flip-back"><PlayerCard player={player} rating={toFielded({ id: 'x', playerId: player.id, stars: 1, trained: 0 }, player, config).rating} kit={kit} scale={4} tag={tags[index]} /></div>
                  </div>
                </button>
                {flipped
                  ? (
                      <div className="flex flex-col items-center gap-1" style={{ animation: reduced ? undefined : 'pp-rise 260ms ease-out' }}>
                        <span className="font-display text-xs" style={{ color: STING_COLOUR[player.rarity] }}>{RARITY_LABEL[player.rarity].toUpperCase()}</span>
                        <span className="text-xl">{player.name}</span>
                        {pending?.guaranteed[index] ? <span className="text-muted">The Star guarantee</span> : null}
                        <button type="button" className="btn btn-primary mt-2 min-h-11 w-48 font-display text-xs" onClick={next}>{index + 1 < players.length ? 'Next' : 'Sign or sell'}</button>
                        {index + 1 < players.length ? <button type="button" className="btn btn-ghost min-h-11 w-48" onClick={() => setPhase('decide')}>Reveal all</button> : null}
                      </div>
                    )
                  : (
                      <>
                        <span className="text-muted">Tap the card to turn it over</span>
                        <button type="button" className="btn btn-ghost min-h-11 w-48" onClick={() => setPhase('decide')}>Reveal all</button>
                      </>
                    )}
              </>
            )
          : null}

        {shown === 'decide'
          ? (
              <>
                <h2>Your new players</h2>
                <ul className="flex w-full justify-center gap-2">
                  {players.map((entry, position) => (
                    <li key={entry.id} className="flex flex-col items-center gap-2" style={{ animation: reduced ? undefined : `pp-card-in 280ms cubic-bezier(.2,.8,.2,1) ${position * 70}ms both` }}>
                      <PlayerCard player={entry} rating={toFielded({ id: 'x', playerId: entry.id, stars: 1, trained: 0 }, entry, config).rating} kit={kit} scale={2} tag={tags[position]} />
                      <span className="flex min-h-10 max-w-24 items-center text-center text-sm leading-tight text-muted">
                        {bestAt[position] ? `Your best ${entry.position}: ${bestAt[position]!.rating}` : `Your first ${entry.position}`}
                      </span>
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
                <span className="text-center text-muted">Everyone is kept unless the bench is full. Three copies of a player merge into a better card, in Squad › Players.</span>
                <div className="flex flex-col items-center gap-1 text-lg">
                  <span>{`Bench after signing: ${benchCount(game.cards, state.lineup) + signing}/${bench}`}</span>
                  <span>
                    <Icon path="icons/currency_coin.png" />
                    {` +${sellTotal} coins from sales`}
                  </span>
                  {overfull ? <span className="text-error" role="alert">{`Your bench has room for ${Math.max(0, room)} more. Sell the rest.`}</span> : null}
                  {room < players.length && state.perks.benchBuys < config.shop.benchSlotsMaxBuys
                    ? <Link to="/shop?from=bench-full" className="link text-base">{`Short of room? +${config.shop.benchSlotsEach} bench places for ${config.shop.gems.benchSlots} gems`}</Link>
                    : null}
                </div>
              </>
            )
          : null}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2 border-t border-base-content/10 p-4">
        {shown === 'decide'
          ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary min-h-12 w-full font-display text-xs"
                  disabled={overfull || decide.isPending}
                  onClick={() => decide.mutate(decisions, {
                    onSuccess: () => {
                      onClose()
                      if (quick && onNext && more > 0)
                        onNext()
                    },
                    onError: error => toast.push(formatError(error), 'error'),
                  })}
                >
                  {decide.isPending ? 'Saving…' : quick && onNext && more > 0 ? `Done · next pack (${more} left)` : 'Done'}
                </button>
                {onNext && more > 0 && !quick
                  ? (
                      <button
                        type="button"
                        className="btn btn-outline min-h-12 w-full"
                        disabled={overfull || decide.isPending}
                        onClick={() => decide.mutate(decisions, { onSuccess: () => {
                          onClose()
                          onNext()
                        }, onError: error => toast.push(formatError(error), 'error') })}
                      >
                        {`Done and open the next pack (${more} left)`}
                      </button>
                    )
                  : null}
              </>
            )
          : <button type="button" className="btn btn-ghost min-h-11" onClick={onClose}>Later</button>}
      </div>
    </div>
  )
}

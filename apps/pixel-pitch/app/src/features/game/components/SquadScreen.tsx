import type { FormationId, GameResponse, Position } from '@ld/pixel-pitch-core'
import type { SquadCard } from '../lib/club'
import { BottomSheet } from '@ld/mobile-ui'
import { autoPick, bestFormation, FORMATION_IDS, FORMATIONS, matchOdds, mergeable, positionFit, scoreLineup, sellValue, trainingCost } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useMemo, useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { art } from '../lib/art'
import { currentScore, kitOf, nextRival, rivalSide, squadCards, squadPool } from '../lib/club'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { PlayerSprite } from './sprites'

const LINE_Y: Record<Position, number> = { FWD: 16, MID: 41, DEF: 64, GK: 86 }

/** Where each slot sits on the half pitch, in percent: one row per line, spread evenly. */
function slotPositions(formation: FormationId) {
  const roles = FORMATIONS[formation].roles
  return roles.map((role, index) => {
    const line = roles.map((entry, at) => ({ entry, at })).filter(item => item.entry === role)
    const order = line.findIndex(item => item.at === index)
    return { role, x: ((order + 1) / (line.length + 1)) * 100, y: LINE_Y[role] }
  })
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const surname = (name: string) => name.split(' ').at(-1) ?? name

function Bar({ label, value, max, colour }: { label: string, value: number, max: number, colour: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10">{label}</span>
      <div className="h-3 flex-1 bg-base-300" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: colour }} />
      </div>
      <span className="w-8 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  )
}

type Sheet = { kind: 'slot', slot: number } | { kind: 'card', cardId: string } | null

export function SquadScreen({ game }: { game: GameResponse }) {
  const toast = useToast()
  const config = useGameConfig()
  const { lookup } = useCatalogue()
  const [sheet, setSheet] = useState<Sheet>(null)
  const { state } = game.club
  const kit = kitOf(game)

  const squad = useMemo(() => squadCards(game, lookup, config), [game, lookup, config])
  const byId = useMemo(() => new Map(squad.map(entry => [entry.card.id, entry])), [squad])
  const pool = useMemo(() => squadPool(game.cards, lookup, config), [game.cards, lookup, config])
  const score = currentScore(game, lookup, config)
  const rival = nextRival(game, config)
  const odds = matchOdds({ formation: state.formation, att: score.att, def: score.def }, rivalSide(rival), config)
  const options = useMemo(() => bestFormation(pool, rivalSide(rival), config), [pool, rival, config])
  const best = options[0]
  const currentOption = options.find(option => option.formation === state.formation)
  const positions = slotPositions(state.formation)

  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const lineup = useGameAction(
    (input: { formation: FormationId, lineup: Array<string | null> }) => gameApi.setLineup(input.formation, input.lineup),
    (current, input) => ({ ...current, club: { ...current.club, state: { ...current.club.state, formation: input.formation, lineup: input.lineup } } }),
  )
  const sell = useGameAction((cardId: string) => gameApi.sell(cardId))
  const train = useGameAction((cardId: string) => gameApi.train(cardId))
  const merge = useGameAction((cardIds: string[]) => gameApi.merge(cardIds))

  const save = (formation: FormationId, ids: Array<string | null>) => lineup.mutate({ formation, lineup: ids }, { onError })

  /** Puts a card in a slot. If it was already playing elsewhere, the two swap. */
  const place = (slot: number, cardId: string | null) => {
    const next = [...state.lineup]
    const from = cardId ? next.indexOf(cardId) : -1
    if (from >= 0)
      next[from] = next[slot]
    next[slot] = cardId
    save(state.formation, next)
    setSheet(null)
  }

  const candidates = (slot: number) => {
    const role = FORMATIONS[state.formation].roles[slot]
    const trial = (cardId: string | null) => {
      const ids = [...state.lineup]
      const from = cardId ? ids.indexOf(cardId) : -1
      if (from >= 0)
        ids[from] = ids[slot]
      ids[slot] = cardId
      return scoreLineup(state.formation, ids.map(id => (id ? byId.get(id)?.fielded ?? null : null))).exact - score.exact
    }
    return squad
      .map(entry => ({ entry, fit: positionFit(entry.player, role), delta: trial(entry.card.id) }))
      .sort((a, b) => b.delta - a.delta || b.entry.fielded.rating * b.fit - a.entry.fielded.rating * a.fit)
  }

  const groups = mergeable(game.cards, config)
  const selected = sheet?.kind === 'card' ? byId.get(sheet.cardId) : undefined

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Formation" className="grid grid-cols-5 gap-1">
        {FORMATION_IDS.map(formation => (
          <button
            key={formation}
            type="button"
            role="radio"
            aria-checked={formation === state.formation}
            className={`flex min-h-11 flex-col items-center justify-center border-2 text-sm leading-tight ${formation === state.formation ? 'border-primary bg-base-100' : 'border-base-300'}`}
            onClick={() => {
              const picked = autoPick(formation, pool).ids
              save(formation, picked.length === 5 ? picked : state.lineup)
            }}
          >
            <span>{FORMATIONS[formation].name}</span>
            <span className="text-muted">{formation}</span>
          </button>
        ))}
      </div>

      <div className="relative w-full" style={{ aspectRatio: '176 / 130' }}>
        <img src={art('pitch/pitch_squad_176x130.png')} alt="" className="pixel absolute inset-0 h-full w-full" />
        {positions.map(({ role, x, y }, slot) => {
          const cardId = state.lineup[slot]
          const entry = cardId ? byId.get(cardId) : undefined
          const fit = entry ? positionFit(entry.player, role) : 0
          return (
            <button
              key={`${state.formation}-${role}-${x}`}
              type="button"
              aria-label={entry ? `${role}: ${entry.player.name}, rated ${entry.fielded.rating}, fit ${percent(fit)}` : `${role}: empty`}
              className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => setSheet({ kind: 'slot', slot })}
            >
              {entry
                ? (
                    <>
                      <PlayerSprite player={entry.player} kit={kit} role={role} scale={2} />
                      <span className="bg-base-300/80 px-1 text-sm leading-none">{surname(entry.player.name)}</span>
                      <span className={`px-1 text-sm leading-none ${fit < 0.75 ? 'bg-error text-error-content' : fit < 1 ? 'bg-warning text-warning-content' : 'bg-success text-success-content'}`}>
                        {`${Math.round(entry.fielded.rating * fit)}`}
                      </span>
                    </>
                  )
                : <span className="flex h-11 w-11 items-center justify-center border-2 border-dashed border-base-content/60 bg-base-300/50">{role}</span>}
            </button>
          )
        })}
      </div>

      <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Lineup strength">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-xs">Score</span>
          <span className="font-display text-lg text-primary tabular-nums">{score.overall}</span>
        </div>
        {score.chemistry > 0 ? <span className="text-success">{`Chemistry +${Math.round(score.chemistry * 100)}%`}</span> : null}
        <Bar label="ATT" value={score.att} max={120} colour="#ff4f79" />
        <Bar label="DEF" value={score.def} max={120} colour="#5ec8ff" />
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-muted">{`Next: ${rival.name} (${FORMATIONS[rival.formation].name}, rated ${rival.rating})`}</span>
          <div className="flex h-4 w-full text-xs" aria-label={`Win ${percent(odds.win)}, draw ${percent(odds.draw)}, loss ${percent(odds.loss)}`}>
            <span className="bg-success" style={{ width: percent(odds.win) }} />
            <span className="bg-warning" style={{ width: percent(odds.draw) }} />
            <span className="bg-error" style={{ width: percent(odds.loss) }} />
          </div>
          <span className="tabular-nums">{`Win ${percent(odds.win)} · Draw ${percent(odds.draw)} · Loss ${percent(odds.loss)}`}</span>
        </div>
        {best && currentOption && best.formation !== state.formation && best.points - currentOption.points > 0.02
          ? (
              <button type="button" className="btn btn-accent min-h-11 text-lg" onClick={() => save(best.formation, best.ids)}>
                {`Try ${FORMATIONS[best.formation].name} against their ${FORMATIONS[rival.formation].name}: win ${percent(best.odds.win)}`}
              </button>
            )
          : <span className="text-muted">This is your best formation against them.</span>}
      </section>

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary min-h-11 flex-1 font-display text-xs" onClick={() => save(state.formation, autoPick(state.formation, pool).ids)} disabled={pool.length === 0}>
          Auto-pick
        </button>
      </div>

      <section className="flex flex-col gap-1" aria-label="Squad">
        <h2>{`Squad (${squad.length})`}</h2>
        <ul className="flex flex-col">
          {squad.map(entry => (
            <li key={entry.card.id}>
              <button type="button" className="flex min-h-11 w-full items-center gap-2 border-b border-base-300 py-1 text-left" onClick={() => setSheet({ kind: 'card', cardId: entry.card.id })}>
                <PlayerSprite player={entry.player} kit={kit} scale={2} />
                <span className="flex flex-1 flex-col leading-tight">
                  <span>{entry.player.name}</span>
                  <span className="text-muted">{`${entry.player.position}${entry.player.altPosition ? `/${entry.player.altPosition}` : ''} · ${'★'.repeat(entry.card.stars)}`}</span>
                </span>
                <span className="text-xl tabular-nums">{entry.fielded.rating}</span>
                {state.lineup.includes(entry.card.id) ? <span className="badge badge-primary">XI</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <BottomSheet open={sheet?.kind === 'slot'} title={sheet?.kind === 'slot' ? `Pick a ${FORMATIONS[state.formation].roles[sheet.slot]}` : ''} onClose={() => setSheet(null)}>
        {sheet?.kind === 'slot'
          ? (
              <ul className="flex flex-col">
                {candidates(sheet.slot).map(({ entry, fit, delta }) => (
                  <li key={entry.card.id}>
                    <button type="button" className="flex min-h-11 w-full items-center gap-2 border-b border-base-300 py-1 text-left" onClick={() => place(sheet.slot, entry.card.id)}>
                      <PlayerSprite player={entry.player} kit={kit} scale={2} />
                      <span className="flex flex-1 flex-col leading-tight">
                        <span>{entry.player.name}</span>
                        <span className="text-muted">{`${entry.player.position} · fit ${percent(fit)}`}</span>
                      </span>
                      <span className="tabular-nums">{Math.round(entry.fielded.rating * fit)}</span>
                      {delta > 0.05 ? <span className="badge badge-success">{`+${delta.toFixed(1)}`}</span> : null}
                    </button>
                  </li>
                ))}
                {state.lineup[sheet.slot] ? <li><button type="button" className="btn btn-ghost min-h-11 w-full" onClick={() => place(sheet.slot, null)}>Leave this slot empty</button></li> : null}
              </ul>
            )
          : null}
      </BottomSheet>

      <BottomSheet open={Boolean(selected)} title={selected?.player.name ?? ''} onClose={() => setSheet(null)}>
        {selected ? <CardActions entry={selected} game={game} groups={groups} onTrain={() => train.mutate(selected.card.id, { onError })} onSell={() => sell.mutate(selected.card.id, { onError, onSuccess: () => setSheet(null) })} onMerge={ids => merge.mutate(ids, { onError, onSuccess: () => setSheet(null) })} busy={train.isPending || sell.isPending || merge.isPending} /> : null}
      </BottomSheet>
    </div>
  )
}

function CardActions({ entry, game, groups, onTrain, onSell, onMerge, busy }: { entry: SquadCard, game: GameResponse, groups: ReturnType<typeof mergeable>, onTrain: () => void, onSell: () => void, onMerge: (ids: string[]) => void, busy: boolean }) {
  const config = useGameConfig()
  const cost = trainingCost(entry.card, entry.player, config)
  const inLineup = game.club.state.lineup.includes(entry.card.id)
  const group = groups.find(cards => cards.some(card => card.id === entry.card.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <PlayerSprite player={entry.player} kit={kitOf(game)} scale={4} />
        <div className="flex flex-col text-lg">
          <span>{`${entry.player.position} · ${entry.player.rarity} · ${'★'.repeat(entry.card.stars)}`}</span>
          <span>{`Rating ${entry.fielded.rating} (trained +${entry.card.trained})`}</span>
        </div>
      </div>
      <button type="button" className="btn btn-primary min-h-11" disabled={busy || 'blocked' in cost || game.club.state.coins < ('cost' in cost ? cost.cost : 0)} onClick={onTrain}>
        {'blocked' in cost ? 'Fully trained' : `Train +1 for ${cost.cost.toLocaleString('en-GB')} coins`}
      </button>
      {group ? <button type="button" className="btn btn-accent min-h-11" disabled={busy} onClick={() => onMerge(group.slice(0, config.cards.mergeCopies).map(card => card.id))}>{`Merge ${config.cards.mergeCopies} copies into ${'★'.repeat(entry.card.stars + 1)}`}</button> : null}
      <button type="button" className="btn btn-outline btn-error min-h-11" disabled={busy || inLineup} onClick={onSell}>
        {inLineup ? 'In the lineup: take them out to sell' : `Sell for ${sellValue(entry.card, entry.player, config).toLocaleString('en-GB')} coins`}
      </button>
    </div>
  )
}

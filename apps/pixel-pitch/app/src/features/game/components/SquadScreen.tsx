import type { FormationId, GameResponse, Position } from '@ld/pixel-pitch-core'
import type { SquadCard } from '../lib/club'
import type { MergeOutcome } from './MergedPop'
import { BottomActions, BottomSheet } from '@ld/mobile-ui'
import { albumPower, autoPick, bestFormation, FORMATION_IDS, FORMATIONS, matchOdds, mergeable, positionFit, scoreLineup, sellValue, trainingCost } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { currentScore, kitOf, nextRival, rivalSide, squadCards, squadPool } from '../lib/club'
import { markCardsSeen, unseenCards } from '../lib/seen-cards'
import { useGameAction } from '../mutations/use-game-action'
import { useCatalogue, useGameConfig } from '../queries/use-game'
import { MergedPop } from './MergedPop'
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
    <>
      <span className="text-sm font-bold">{label}</span>
      <div className="h-2.5 bg-base-200" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: colour }} />
      </div>
      <span className="text-right tabular-nums">{Math.round(value)}</span>
    </>
  )
}

type Sheet = { kind: 'slot', slot: number } | { kind: 'card', cardId: string } | null
type View = 'lineup' | 'players'
type Sort = 'newest' | 'rating' | 'position'
type Filter = 'all' | Position | 'merge' | 'train'

const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
const FILTERS: Array<{ value: Filter, label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'GK', label: 'GK' },
  { value: 'DEF', label: 'DEF' },
  { value: 'MID', label: 'MID' },
  { value: 'FWD', label: 'FWD' },
  { value: 'train', label: 'Can train' },
  { value: 'merge', label: 'Can merge' },
]

/** The colour of a rating badge on the pitch: how well the player suits the slot. */
function fitTone(fit: number) {
  return fit < 0.75 ? 'bg-error text-error-content' : fit < 1 ? 'bg-warning text-warning-content' : 'bg-success text-success-content'
}

export function SquadScreen({ game }: { game: GameResponse }) {
  const toast = useToast()
  const config = useGameConfig()
  const { lookup } = useCatalogue()
  const [search, setSearch] = useSearchParams()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [view, setView] = useState<View>(() => (search.get('view') === 'train' || search.get('view') === 'merge' ? 'players' : 'lineup'))
  const [sort, setSort] = useState<Sort>('newest')
  const [filter, setFilter] = useState<Filter>(() => (search.get('view') === 'train' ? 'train' : search.get('view') === 'merge' ? 'merge' : 'all'))
  const first = search.get('first') === '1'
  const { state } = game.club
  const kit = kitOf(game)

  const squad = useMemo(() => squadCards(game, lookup, config), [game, lookup, config])
  const byId = useMemo(() => new Map(squad.map(entry => [entry.card.id, entry])), [squad])
  const pool = useMemo(() => squadPool(game.cards, lookup, config), [game.cards, lookup, config])
  const score = currentScore(game, lookup, config)
  const rival = nextRival(game, config)
  const warmup = state.league.warmupBonus
  const odds = matchOdds({ formation: state.formation, att: score.att, def: score.def }, rivalSide(rival), config, warmup)
  const bonus = albumPower(state, config)
  const options = useMemo(() => bestFormation(pool, rivalSide(rival), config, bonus), [pool, rival, config, bonus])
  const best = options[0]
  const currentOption = options.find(option => option.formation === state.formation)
  // Already the best formation against this rival, or close enough that switching would not help.
  const isBest = !best || !currentOption || best.formation === state.formation || best.points - currentOption.points <= 0.02
  const positions = slotPositions(state.formation)

  // New signings since the squad was last looked at on this phone. Worked out once on arrival, then all marked seen.
  const [unseen] = useState(() => unseenCards(game.cards.map(card => card.id)))
  const cardIds = game.cards.map(card => card.id).join(',')
  useEffect(() => {
    markCardsSeen(cardIds ? cardIds.split(',') : [])
  }, [cardIds])

  const onError = (error: unknown) => toast.push(formatError(error), 'error')
  const lineup = useGameAction(
    (input: { formation: FormationId, lineup: Array<string | null> }) => gameApi.setLineup(input.formation, input.lineup),
    (current, input) => ({ ...current, club: { ...current.club, state: { ...current.club.state, formation: input.formation, lineup: input.lineup } } }),
  )
  const sell = useGameAction((cardId: string) => gameApi.sell(cardId))
  const train = useGameAction((cardId: string) => gameApi.train(cardId))
  const merge = useGameAction((cardIds: string[]) => gameApi.merge(cardIds))
  const [merged, setMerged] = useState<MergeOutcome | null>(null)

  /** Merges the copies, then says what changed: the new card is the one the answer has that the squad did not. */
  const doMerge = (ids: string[], after?: () => void) => {
    const copies = game.cards.filter(card => ids.includes(card.id))
    const player = copies[0] ? lookup(copies[0].playerId) : undefined
    const known = new Set(game.cards.map(card => card.id))
    merge.mutate(ids, {
      onError,
      onSuccess: (response) => {
        after?.()
        const card = response.cards.find(entry => !known.has(entry.id) && entry.playerId === copies[0]?.playerId)
        if (!player || !card)
          return
        const best = copies.reduce((most, entry) => (entry.trained > most.trained ? entry : most), copies[0])
        setMerged({ player, before: best, after: card, copies: copies.length, inLineup: response.club.state.lineup.includes(card.id) })
      },
    })
  }

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
  const inGroup = new Set(groups.flat().map(card => card.id))
  const canTrain = (entry: SquadCard) => {
    const cost = trainingCost(entry.card, entry.player, config)
    return 'cost' in cost && state.coins >= cost.cost
  }
  const selected = sheet?.kind === 'card' ? byId.get(sheet.cardId) : undefined

  const order = (list: SquadCard[]) => {
    const index = new Map(game.cards.map((card, at) => [card.id, at]))
    const newest = (a: SquadCard, b: SquadCard) => (index.get(b.card.id) ?? 0) - (index.get(a.card.id) ?? 0)
    return [...list].sort((a, b) => {
      // New signings first whatever the order, so they are easy to find.
      const fresh = Number(unseen.has(b.card.id)) - Number(unseen.has(a.card.id))
      if (fresh !== 0)
        return fresh
      if (sort === 'rating')
        return b.fielded.rating - a.fielded.rating || newest(a, b)
      if (sort === 'position')
        return POSITION_ORDER[a.player.position] - POSITION_ORDER[b.player.position] || b.fielded.rating - a.fielded.rating
      return newest(a, b)
    })
  }
  const shown = order(squad.filter((entry) => {
    if (filter === 'all')
      return true
    if (filter === 'merge')
      return inGroup.has(entry.card.id)
    if (filter === 'train')
      return canTrain(entry)
    return entry.player.position === filter || entry.player.altPosition === filter
  }))

  return (
    <div className="flex flex-col gap-4">
      {first
        ? (
            <section className="flex flex-col gap-2 border-2 border-primary bg-base-100 p-3" aria-label="Your squad">
              <h2 className="text-primary">Your squad</h2>
              <span className="text-lg">These five play your league matches. Each one kicks off on its own every few hours, so the lineup you leave here is the one that plays.</span>
              <span className="text-muted">Pick a formation to suit your players, or tap a shirt to swap someone in. Get new players from packs, and train them with coins.</span>
              <button type="button" className="btn btn-primary min-h-11 font-display text-xs" onClick={() => setSearch({}, { replace: true })}>Got it</button>
            </section>
          )
        : null}

      {view === 'lineup'
        ? (
            <>
              <div role="radiogroup" aria-label="Formation" className="grid grid-cols-5 gap-1.5">
                {FORMATION_IDS.map(formation => (
                  <button
                    key={formation}
                    type="button"
                    role="radio"
                    aria-checked={formation === state.formation}
                    className={`flex h-13 flex-col items-center justify-center leading-tight ${formation === state.formation ? 'bg-raised shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]'}`}
                    onClick={() => {
                      const picked = autoPick(formation, pool).ids
                      save(formation, picked.length === 5 ? picked : state.lineup)
                    }}
                  >
                    <span className="text-sm font-bold">{FORMATIONS[formation].name}</span>
                    <span className="text-xs text-muted">{formation}</span>
                  </button>
                ))}
              </div>

              <section
                aria-label="Pitch"
                className="relative h-72 overflow-hidden shadow-[inset_0_0_0_3px_var(--color-slate)]"
                style={{ background: 'repeating-linear-gradient(0deg, var(--color-pitch) 0 36px, var(--color-pitch-dark) 36px 72px)' }}
              >
                <div aria-hidden="true" className="absolute top-0 left-1/2 h-11 w-24 -translate-x-1/2 rounded-b-full border-2 border-t-0 border-white/45" />
                <div aria-hidden="true" className="absolute bottom-0 left-1/2 h-14 w-38 -translate-x-1/2 border-2 border-b-0 border-white/45" />
                {positions.map(({ role, x, y }, slot) => {
                  const cardId = state.lineup[slot]
                  const entry = cardId ? byId.get(cardId) : undefined
                  const fit = entry ? positionFit(entry.player, role) : 0
                  return (
                    <button
                      key={`${state.formation}-${role}-${x}`}
                      type="button"
                      aria-label={entry ? `${role}: ${entry.player.name}, a ${entry.player.position}, rated ${entry.fielded.rating}, plays at ${Math.round(entry.fielded.rating * fit)} here` : `${role}: empty`}
                      className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onClick={() => setSheet({ kind: 'slot', slot })}
                    >
                      {entry
                        ? (
                            <>
                              <PlayerSprite player={entry.player} kit={kit} role={role} scale={2} />
                              <span className="mt-0.5 bg-base-200 px-1.5 text-sm font-semibold text-white">{surname(entry.player.name)}</span>
                              <span className={`px-1.5 text-sm font-bold ${fitTone(fit)}`}>
                                {fit < 1 ? `${Math.round(entry.fielded.rating * fit)} (${entry.player.position})` : `${entry.fielded.rating}`}
                              </span>
                            </>
                          )
                        : <span className="flex h-11 w-11 items-center justify-center border-2 border-dashed border-white/60 bg-base-200/50 font-bold">{role}</span>}
                    </button>
                  )
                })}
              </section>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="What the colours mean">
                <span>
                  <span className="bg-success px-1 font-bold text-success-content">70</span>
                  {' own position'}
                </span>
                <span>
                  <span className="bg-warning px-1 font-bold text-warning-content">63 (MID)</span>
                  {' close: 90% or 75%'}
                </span>
                <span>
                  <span className="bg-error px-1 font-bold text-error-content">39 (DEF)</span>
                  {' out of position: 55%'}
                </span>
              </div>

              <section className="flex flex-col gap-2 bg-base-100 p-3 shadow-[inset_0_0_0_2px_var(--color-slate)]" aria-label="Lineup strength">
                <div className="flex items-center justify-between">
                  <span className="pp-label">Lineup score</span>
                  <span className="text-3xl leading-none font-bold text-primary tabular-nums">{score.overall}</span>
                </div>
                {score.chemistry > 0 ? <span className="text-sm text-success">{`Chemistry +${Math.round(score.chemistry * 100)}% (players from one nation)`}</span> : null}
                {bonus > 0 ? <span className="text-sm text-success">{`Album +${Math.round(bonus * 100)}% team power`}</span> : null}
                <div className="grid grid-cols-[2.75rem_1fr_2rem] items-center gap-x-2.5 gap-y-1.5">
                  <Bar label="ATT" value={score.att} max={120} colour="var(--color-error)" />
                  <Bar label="DEF" value={score.def} max={120} colour="var(--color-accent)" />
                </div>
                <span className="mt-1 text-sm text-muted">{`Next: ${rival.name} (${FORMATIONS[rival.formation].name}, rated ${rival.rating})`}</span>
                <div className="flex h-2.5 gap-0.5" aria-hidden="true">
                  <span className="bg-success" style={{ width: percent(odds.win) }} />
                  <span className="bg-warning" style={{ width: percent(odds.draw) }} />
                  <span className="bg-error" style={{ width: percent(odds.loss) }} />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums">{`Win ${percent(odds.win)} · Draw ${percent(odds.draw)} · Loss ${percent(odds.loss)}`}</span>
                  {isBest ? <span className="bg-success px-1.5 font-bold text-success-content" title={`${FORMATIONS[state.formation].name} is your best formation against them.`}>BEST</span> : null}
                </div>
                {warmup > 0 ? <span className="text-sm text-success">{`Includes your warm-up: +${Math.round(warmup * 100)}% attack.`}</span> : null}
                {isBest
                  ? <span className="sr-only">{`${FORMATIONS[state.formation].name} is your best formation against them.`}</span>
                  : (
                      <button type="button" className="btn btn-outline min-h-11" onClick={() => save(best!.formation, best!.ids)}>
                        {`Switch to ${FORMATIONS[best!.formation].name} with your best five: win ${percent(best!.odds.win)}`}
                      </button>
                    )}
              </section>

              <BottomActions>
                <div className="flex gap-2.5">
                  <button type="button" className="btn btn-accent h-12 flex-1" onClick={() => save(state.formation, autoPick(state.formation, pool).ids)} disabled={pool.length === 0}>
                    Auto-pick best
                  </button>
                  <button type="button" className="btn btn-outline h-12 flex-1" onClick={() => setView('players')}>
                    {`Players (${squad.length})`}
                  </button>
                </div>
              </BottomActions>
            </>
          )
        : (
            <>
              <div className="flex items-center gap-3">
                <button type="button" className="btn btn-outline btn-sm min-h-11" onClick={() => setView('lineup')}>‹ Lineup</button>
                <h2>{`Players (${squad.length})`}</h2>
              </div>
              {groups.length > 0
                ? (
                    <section className="flex flex-col gap-2 border-2 border-accent bg-base-100 p-3" aria-label="Ready to merge">
                      <h2>Ready to merge</h2>
                      <span className="text-muted">{`${config.cards.mergeCopies} copies of a player make one card a star higher (+${config.cards.mergeBonus} rating).`}</span>
                      {groups.map((group) => {
                        const player = lookup(group[0].playerId)
                        return (
                          <button key={group[0].id} type="button" className="btn btn-accent min-h-11 justify-between" disabled={merge.isPending} onClick={() => doMerge(group.slice(0, config.cards.mergeCopies).map(card => card.id))}>
                            <span>{`${player?.name ?? 'Player'} ×${group.length}`}</span>
                            <span>{`Merge into ${'★'.repeat(group[0].stars + 1)}`}</span>
                          </button>
                        )
                      })}
                    </section>
                  )
                : null}

              <div className="flex flex-col gap-2">
                <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1">
                  {FILTERS.map(entry => (
                    <button key={entry.value} type="button" role="radio" aria-checked={filter === entry.value} className={`min-h-11 px-3 text-sm font-semibold ${filter === entry.value ? 'bg-raised text-primary shadow-[inset_0_0_0_3px_var(--color-primary)]' : 'bg-base-100 shadow-[inset_0_0_0_2px_var(--color-slate)]'}`} onClick={() => setFilter(entry.value)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-muted">Sort</span>
                  <select className="select select-sm min-h-11 flex-1 bg-base-100" value={sort} onChange={event => setSort(event.target.value as Sort)}>
                    <option value="newest">Newest first</option>
                    <option value="rating">Highest rated</option>
                    <option value="position">By position</option>
                  </select>
                </label>
              </div>

              <section className="flex flex-col gap-1" aria-label="Squad">
                <span className="text-muted">{`${squad.length} players, room for ${config.cards.benchSize} on the bench as well as your five. Tap a player to train, merge or sell.`}</span>
                {shown.length === 0
                  ? <span className="py-4 text-center text-muted">{filter === 'train' ? 'Nobody you can afford to train right now.' : filter === 'merge' ? `No player with ${config.cards.mergeCopies} copies yet.` : 'Nobody here.'}</span>
                  : null}
                <ul className="flex flex-col gap-1.5">
                  {shown.map(entry => (
                    <li key={entry.card.id}>
                      <button type="button" className="flex min-h-14 w-full items-center gap-2.5 bg-base-100 px-3 py-1.5 text-left shadow-[inset_0_0_0_2px_var(--color-slate)]" onClick={() => setSheet({ kind: 'card', cardId: entry.card.id })}>
                        <PlayerSprite player={entry.player} kit={kit} scale={2} />
                        <span className="flex flex-1 flex-col leading-tight">
                          <span>
                            {entry.player.name}
                            {unseen.has(entry.card.id) ? <span className="badge badge-secondary badge-sm ml-1">NEW</span> : null}
                          </span>
                          <span className="text-muted">{`${entry.player.position}${entry.player.altPosition ? `/${entry.player.altPosition}` : ''} · ${'★'.repeat(entry.card.stars)}${inGroup.has(entry.card.id) ? ' · can merge' : ''}`}</span>
                        </span>
                        {canTrain(entry) ? <span className="text-success" aria-label="Can train">▲</span> : null}
                        <span className="text-xl font-bold text-primary tabular-nums">{entry.fielded.rating}</span>
                        {state.lineup.includes(entry.card.id) ? <span className="badge badge-primary">XI</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

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
                        <span className="text-muted">{`${entry.player.position} · rated ${entry.fielded.rating}, ${percent(fit)} here`}</span>
                      </span>
                      <span className={`px-1 tabular-nums ${fitTone(fit)}`}>{Math.round(entry.fielded.rating * fit)}</span>
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
        {selected ? <CardActions entry={selected} game={game} groups={groups} onTrain={() => train.mutate(selected.card.id, { onError, onSuccess: () => toast.push(`${selected.player.name} trained: +1 rating`, 'success') })} onSell={() => sell.mutate(selected.card.id, { onError, onSuccess: () => setSheet(null) })} onMerge={ids => doMerge(ids, () => setSheet(null))} busy={train.isPending || sell.isPending || merge.isPending} /> : null}
      </BottomSheet>
      {merged ? <MergedPop outcome={merged} kit={kit} onClose={() => setMerged(null)} /> : null}
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
          <span>{`Rating ${entry.fielded.rating} (trained +${entry.card.trained} of ${config.cards.trainingCap[entry.player.rarity]})`}</span>
        </div>
      </div>
      <button type="button" className="btn btn-primary min-h-11" disabled={busy || 'blocked' in cost || game.club.state.coins < ('cost' in cost ? cost.cost : 0)} onClick={onTrain}>
        {'blocked' in cost ? 'Fully trained' : `Train +1 rating for ${cost.cost.toLocaleString('en-GB')} coins`}
      </button>
      <span className="text-muted">Training adds 1 to this card's rating for good, up to a limit set by rarity. Each session costs more than the last.</span>
      {group ? <button type="button" className="btn btn-accent min-h-11" disabled={busy} onClick={() => onMerge(group.slice(0, config.cards.mergeCopies).map(card => card.id))}>{`Merge ${config.cards.mergeCopies} copies into ${'★'.repeat(entry.card.stars + 1)}`}</button> : null}
      <button type="button" className="btn btn-outline btn-error min-h-11" disabled={busy || inLineup} onClick={onSell}>
        {inLineup ? 'In the lineup: take them out to sell' : `Sell for ${sellValue(entry.card, entry.player, config).toLocaleString('en-GB')} coins`}
      </button>
    </div>
  )
}

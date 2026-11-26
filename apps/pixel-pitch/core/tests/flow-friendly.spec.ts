import type { ClubState, FlowContext, OwnedCard } from '../src'
import { describe, expect, it } from 'vitest'
import { autoPick, DEFAULT_CONFIG, generateCatalogue, isGameRuleError, newClubState, paidFriendliesLeft, playFriendly, toFielded } from '../src'

const config = DEFAULT_CONFIG
const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

/** A club with five players picked into the lineup. */
function context(now = T0, state?: ClubState): FlowContext {
  const cards: OwnedCard[] = catalogue.slice(0, 5).map((player, index) => ({ id: `c${index}`, playerId: player.id, stars: 1, trained: 0 }))
  const base = state ?? newClubState(T0, config)
  const ids = autoPick(base.formation, cards.map(card => ({ id: card.id, ...toFielded(card, byId.get(card.playerId)!, config) }))).ids
  return { state: state ?? { ...base, lineup: ids }, cards, catalogue, players: id => byId.get(id), config, clubId: 'club-1', now }
}

describe('playFriendly', () => {
  it('plays a match now, numbered below the debut, with no league points', () => {
    const result = playFriendly(context())
    const fixture = result.extra!.fixture
    expect(fixture.no).toBe(-2)
    expect(fixture.kickoffAt).toBe(T0)
    expect(fixture.points).toBe(0)
    expect(fixture.goalsFor + fixture.goalsAgainst).toBe(fixture.events.filter(event => event.kind === 'goal').length)
    expect(result.state.league).toEqual(context().state.league)
    expect(result.state.pass).toEqual(context().state.pass)
    expect(result.state.friendlies.played).toBe(1)
  })

  it('pays coins for the result, for the first few a day only', () => {
    let ctx = context()
    const paid: number[] = []
    for (let match = 0; match < config.friendly.paidPerDay + 2; match++) {
      const result = playFriendly(ctx)
      paid.push(result.extra!.fixture.coins)
      expect(result.state.coins - ctx.state.coins).toBe(result.extra!.fixture.coins)
      ctx = { ...ctx, state: result.state }
    }
    expect(paid.slice(0, config.friendly.paidPerDay).every(coins => coins > 0)).toBe(true)
    expect(paid.slice(config.friendly.paidPerDay)).toEqual([0, 0])
    expect(paidFriendliesLeft(ctx.state, config, T0)).toBe(0)
    expect(paidFriendliesLeft(ctx.state, config, T0 + DAY)).toBe(config.friendly.paidPerDay)
  })

  it('gives the same match for the same club and friendly number, and a different rival next time', () => {
    const first = playFriendly(context()).extra!.fixture
    expect(playFriendly(context()).extra!.fixture).toEqual(first)
    const second = playFriendly(context(T0, playFriendly(context()).state)).extra!.fixture
    expect(second.no).toBe(-3)
    expect(second.rival.index).not.toBe(first.rival.index)
  })

  it('needs at least one player in the lineup', () => {
    const ctx = context()
    try {
      playFriendly({ ...ctx, state: { ...ctx.state, lineup: [null, null, null, null, null] } })
      expect.unreachable()
    }
    catch (error) {
      expect(isGameRuleError(error) && error.code).toBe('no-lineup')
    }
  })
})

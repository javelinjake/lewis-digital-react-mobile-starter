import type { ClubState, OwnedCard, Player, SyncResult } from '../src'
import { createRng } from '@ld/utils/random/rng'
import { describe, expect, it } from 'vitest'
import { clubNotificationTimes, DEFAULT_CONFIG, generateCatalogue, isGameRuleError, lineupForMatch, mergeInClub, NEW_CARD_PREFIX, newClubState, playDebut, rollStarterSquad, sellCard, setLineup, syncClub, trainInClub } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 8, 12)

const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))
const players = (id: string) => byId.get(id)
const firstOf = (position: Player['position']) => catalogue.find(player => player.position === position && player.rarity === 'pro')!

const cards: OwnedCard[] = [firstOf('FWD'), firstOf('FWD'), firstOf('DEF'), firstOf('DEF'), firstOf('GK')]
  .map((player, index) => ({ id: `card-${index}`, playerId: player.id, stars: 1, trained: 0 }))
const ready = (): ClubState => setLineup(newClubState(T0, config), '2-2', cards.map(card => card.id), cards)
const sync = (state: ClubState, now: number): SyncResult => syncClub({ state, cards, players, clubId: 'club-1', config, now })

describe('a new club', () => {
  it('starts with an empty lineup, no coins and the first match three hours away', () => {
    const club = newClubState(T0, config)
    expect(club.lineup).toEqual([null, null, null, null, null])
    expect(club.coins).toBe(0)
    expect(club.league.nextKickoffAt).toBe(T0 + 3 * HOUR)
  })
})

describe('setLineup', () => {
  it('fields the player\'s own cards in the chosen formation', () => {
    const club = setLineup(newClubState(T0, config), '1-1-2', ['card-0', 'card-1', null, 'card-2', 'card-4'], cards)
    expect(club.formation).toBe('1-1-2')
    expect(lineupForMatch(club, cards, players, config).players.filter(Boolean)).toHaveLength(4)
  })

  it('refuses someone else\'s card, a player twice, a bad formation or the wrong number of slots', () => {
    const club = newClubState(T0, config)
    const refusal = (run: () => unknown) => {
      try {
        run()
      }
      catch (error) {
        return isGameRuleError(error) ? error.code : 'other'
      }
      return 'accepted'
    }
    expect(refusal(() => setLineup(club, '2-2', ['someone-elses', null, null, null, null], cards))).toBe('not-owned')
    expect(refusal(() => setLineup(club, '2-2', ['card-0', 'card-0', null, null, null], cards))).toBe('duplicate')
    expect(refusal(() => setLineup(club, '4-4-2', [null, null, null, null, null], cards))).toBe('formation')
    expect(refusal(() => setLineup(club, '2-2', [null, null, null], cards))).toBe('lineup-size')
  })

  it('plays a slot empty once its card is gone', () => {
    const lineup = lineupForMatch(ready(), cards.slice(1), players, config)
    expect(lineup.players[0]).toBeNull()
    expect(lineup.players.slice(1).every(Boolean)).toBe(true)
  })
})

describe('syncClub', () => {
  it('fills the shelf, plays the matches that fell due and pays their coins', () => {
    const result = sync(ready(), T0 + 10 * HOUR)
    expect(result.fixtures).toHaveLength(3)
    expect(result.state.idle.shelfPacks).toBe(10)
    expect(result.state.coins).toBe(result.fixtures.reduce((sum, match) => sum + match.coins, 0))
    const summary = result.events.find(event => event.type === 'matches')
    expect(summary).toMatchObject({ type: 'matches', played: 3, coins: result.state.coins, skipped: 0 })
  })

  it('reports nothing about matches when none were due', () => {
    const result = sync(ready(), T0 + HOUR)
    expect(result.fixtures).toEqual([])
    expect(result.events.some(event => event.type === 'matches')).toBe(false)
  })

  it('gives the same club whether it catches up in pieces or all at once', () => {
    const rng = createRng('club-invariance')
    for (let run = 0; run < 25; run++) {
      // Below the catch-up limit (56 matches = 168 hours), where nothing is skipped.
      const end = T0 + rng.int(1, 165) * HOUR
      const times = Array.from({ length: rng.int(1, 6) }, () => T0 + rng.int(0, end - T0)).sort((a, b) => a - b)

      let state = ready()
      const fixtures = []
      for (const time of [...times, end]) {
        const part = sync(state, time)
        fixtures.push(...part.fixtures)
        state = part.state
      }
      const once = sync(ready(), end)

      // Daily gems are the one deliberate exception: they reward each day the player opens the game, so two visits on
      // two days earn twice what one visit does.
      const withoutGems = (club: ClubState) => ({ ...club, idle: { ...club.idle, gems: 0, gemsGrantedForDay: 0 } })
      expect(fixtures).toEqual(once.fixtures)
      expect(withoutGems(state)).toEqual(withoutGems(once.state))
    }
  })

  it('reports a promotion in the summary', () => {
    const club = { ...ready(), league: { ...ready().league, points: 29 } }
    const result = sync(club, T0 + 3 * HOUR)
    expect(result.events.find(event => event.type === 'matches')).toMatchObject({ promotedTo: 2 })
  })
})

describe('clubNotificationTimes', () => {
  it('includes the next kick-off', () => {
    const club = ready()
    expect(clubNotificationTimes(club, config, T0).nextKickoffAt).toBe(T0 + 3 * HOUR)
  })
})

describe('starter squad and debut', () => {
  it('gives one player per starter position, exactly one Pro, no duplicates', () => {
    for (let seed = 0; seed < 50; seed++) {
      const squad = rollStarterSquad({ catalogue, seed, config })
      expect(squad.map(player => player.position)).toEqual(config.onboarding.starterPositions)
      expect(squad.filter(player => player.rarity === 'pro')).toHaveLength(1)
      expect(squad.every(player => ['grassroots', 'semipro', 'pro'].includes(player.rarity))).toBe(true)
      expect(new Set(squad.map(player => player.id)).size).toBe(squad.length)
    }
  })

  it('always wins the debut, the same way for the same club, and pays a win', () => {
    const starters = rollStarterSquad({ catalogue, seed: 'club-9', config })
    const squad: OwnedCard[] = starters.map((player, index) => ({ id: `s${index}`, playerId: player.id, stars: 1, trained: 0 }))
    const club = setLineup(newClubState(T0, config), '2-2', squad.map(card => card.id), squad)
    const debut = playDebut({ state: club, cards: squad, players, clubId: 'club-9', config, now: T0 })
    expect(debut.fixture.result).toBe('win')
    expect(debut.state.coins).toBe(config.league.winCoins)
    expect(debut.state.league).toEqual(club.league)
    expect(playDebut({ state: club, cards: squad, players, clubId: 'club-9', config, now: T0 })).toEqual(debut)
  })
})

describe('selling, merging and training in a club', () => {
  const copies: OwnedCard[] = [0, 1, 2].map(index => ({ id: `copy-${index}`, playerId: cards[0].playerId, stars: 1, trained: index }))
  const squad = [...cards, ...copies]
  const code = (run: () => unknown) => {
    try {
      run()
      return 'accepted'
    }
    catch (error) {
      return isGameRuleError(error) ? error.code : 'other'
    }
  }

  it('sells a bench player for coins but not one in the lineup', () => {
    const club = setLineup(newClubState(T0, config), '2-2', cards.map(card => card.id), squad)
    const sold = sellCard(club, squad, 'copy-0', players, config)
    expect(sold.coins).toBe(config.cards.sellValue.pro)
    expect(sold.state.coins).toBe(sold.coins)
    expect(sold.cards.map(card => card.id)).not.toContain('copy-0')
    expect(code(() => sellCard(club, squad, 'card-0', players, config))).toBe('in-lineup')
    expect(code(() => sellCard(club, squad, 'nope', players, config))).toBe('not-owned')
  })

  it('merges three copies into a new card that takes a merged card\'s lineup slot', () => {
    const club = setLineup(newClubState(T0, config), '2-2', ['copy-0', 'card-1', 'card-2', 'card-3', 'card-4'], squad)
    const merged = mergeInClub(club, squad, ['copy-0', 'copy-1', 'copy-2'], config)
    expect(merged.merged).toMatchObject({ id: `${NEW_CARD_PREFIX}merged`, stars: 2, trained: 2 })
    expect(merged.state.lineup[0]).toBe(merged.merged.id)
    expect(merged.cards).toHaveLength(squad.length - 2)
    expect(code(() => mergeInClub(club, squad, ['copy-0', 'copy-1', 'card-2'], config))).toBe('merge-mismatch')
  })

  it('trains for coins, refusing when the club cannot afford it', () => {
    const broke = newClubState(T0, config)
    expect(code(() => trainInClub(broke, squad, 'card-0', players, config))).toBe('coins')
    const rich = { ...broke, coins: 10_000 }
    const trained = trainInClub(rich, squad, 'card-0', players, config)
    expect(trained.coins).toBe(-config.cards.trainingCost.pro)
    expect(trained.state.coins).toBe(10_000 - config.cards.trainingCost.pro)
    expect(trained.cards.find(card => card.id === 'card-0')!.trained).toBe(1)
  })
})

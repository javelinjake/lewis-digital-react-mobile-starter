import type { ClubState, FixtureResult, FlowContext, GameConfig, GameResponse, OwnedCard, Player } from '@ld/pixel-pitch-core'
import type { GameApi } from './game-api.types'
import { arcadePack, buyPack, claimAlbumSet, claimCalendar, claimFreePack, claimGoal, claimPassTier, collectStadium, collectTray, decidePack, DEFAULT_CONFIG, finishPlay, finishWarmup, foundClub, generateCatalogue, mergeInClub, NEW_CARD_PREFIX, openPack, sellCard, setLineup, startPlay, startWarmup, syncClub, trainInClub, upgradeStadium, upgradeState } from '@ld/pixel-pitch-core'
import { useAuthStore } from '@/stores/auth.store'

// The game rules running in the browser instead of on the server: development, Playwright and Lighthouse use it.
// It mirrors the api's actions using the same rules from @ld/pixel-pitch-core, and keeps each user's club in
// sessionStorage. Playwright moves the clock with window.__pixelPitchClock.

interface MockClub {
  club: GameResponse['club']
  cards: OwnedCard[]
  fixtures: FixtureResult[]
  nextCardId: number
}

const config: GameConfig = DEFAULT_CONFIG
const catalogue: Player[] = generateCatalogue(config, 'pixel-pitch-catalogue')
const byId = new Map(catalogue.map(player => [player.id, player]))
const players = (id: string) => byId.get(id)
const CLOCK_KEY = 'pp-mock-clock'

class MockRuleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

function clockOffset() {
  return Number(sessionStorage.getItem(CLOCK_KEY) ?? 0)
}

function now() {
  return Date.now() + clockOffset()
}

if (typeof window !== 'undefined') {
  window.__pixelPitchClock = {
    advance: (ms: number) => sessionStorage.setItem(CLOCK_KEY, String(clockOffset() + ms)),
    offset: clockOffset,
    // Tests only: the League Pass is bought in the shop (a later milestone), so this switches its premium track on.
    setPass: (on: boolean) => {
      const club = load()
      if (club)
        save({ ...club, club: { ...club.club, state: { ...club.club.state, idle: { ...club.club.state.idle, hasPass: on } } } })
    },
  }
}

function storageKey() {
  return `pp-mock-club:${useAuthStore.getState().userId ?? 'anonymous'}`
}

/**
 * The server's rule for a player on this device signing in to the cloud: an account with a club keeps it and the
 * device's club is deleted; an account with none takes the device's club. Copied here so the mock behaves the same.
 */
useAuthStore.subscribe((next, previous) => {
  if (!previous.user?.isAnonymous || !next.userId || next.userId === previous.userId)
    return
  const from = `pp-mock-club:${previous.userId}`
  const to = `pp-mock-club:${next.userId}`
  const device = sessionStorage.getItem(from)
  sessionStorage.removeItem(from)
  if (device && !sessionStorage.getItem(to))
    sessionStorage.setItem(to, device)
})

function load(): MockClub | null {
  const raw = sessionStorage.getItem(storageKey())
  if (!raw)
    return null
  const saved = JSON.parse(raw) as MockClub
  // A club saved before newer features existed gets their starting values, as the api does.
  return { ...saved, club: { ...saved.club, state: upgradeState(saved.club.state, config) } }
}

function save(club: MockClub) {
  sessionStorage.setItem(storageKey(), JSON.stringify(club))
}

/** Gives new cards real ids and swaps them into the lineup, as the api does. */
function assignIds(mock: MockClub, state: ClubState, cards: OwnedCard[]) {
  const ids = new Map<string, string>()
  const next = cards.map((card) => {
    if (!card.id.startsWith(NEW_CARD_PREFIX))
      return card
    const id = String(mock.nextCardId++)
    ids.set(card.id, id)
    return { ...card, id }
  })
  return { cards: next, state: { ...state, lineup: state.lineup.map(id => (id ? ids.get(id) ?? id : null)) } }
}

async function respond<T = object>(run: (mock: MockClub, at: number, ctx: FlowContext) => { state: ClubState, cards?: OwnedCard[], fixtures?: FixtureResult[], extra?: T }): Promise<GameResponse & T> {
  const mock = load()
  if (!mock)
    throw new MockRuleError('Create your club first.', 404)
  const at = now()
  const synced = syncClub({ state: mock.club.state, cards: mock.cards, players, clubId: mock.club.id, config, now: at })
  const ctx: FlowContext = { state: synced.state, cards: mock.cards, catalogue, players, config, clubId: mock.club.id, now: at }
  const result = run({ ...mock, club: { ...mock.club, state: synced.state } }, at, ctx)
  const assigned = assignIds(mock, result.state, result.cards ?? mock.cards)
  const fixtures = [...synced.fixtures, ...(result.fixtures ?? [])]
  const next: MockClub = {
    club: { ...mock.club, state: assigned.state, version: mock.club.version + 1 },
    cards: assigned.cards,
    fixtures: [...mock.fixtures, ...fixtures],
    nextCardId: mock.nextCardId,
  }
  save(next)
  // A little latency, so pending states show in development as they would on a phone.
  await new Promise(resolve => setTimeout(resolve, 120))
  return { club: next.club, cards: next.cards, fixtures, events: synced.events, now: at, configVersion: config.version, ...(result.extra ?? {} as T) }
}

function wrap<T>(run: () => T): T {
  try {
    return run()
  }
  catch (error) {
    throw new MockRuleError(error instanceof Error ? error.message : String(error))
  }
}

/** `?mock-club=1` (with `?mock-user=`) opens the game screens with a club already founded, for Lighthouse. */
function seedRequested() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock-club') === '1'
}

export const gameApi: GameApi = {
  async sync() {
    if (!load()) {
      if (!seedRequested())
        return null
      await gameApi.createClub({ name: 'Harbour Town', crest: 0, kitPrimary: '#3f7fd6', kitSecondary: '#f4f4f4' })
    }
    return respond(mock => ({ state: mock.club.state }))
  },
  async createClub(input) {
    if (load())
      throw new MockRuleError('You already have a club.', 409)
    const at = now()
    const id = Math.floor(Math.random() * 1_000_000)
    const founded = foundClub({ clubId: id, now: at, config, catalogue, players })
    // Real ids for the starter cards, as the database gives them.
    const cards = founded.cards.map((card, index) => ({ ...card, id: String(index + 1) }))
    const lineup = founded.state.lineup.map(cardId => (cardId ? String(Number(cardId.slice(NEW_CARD_PREFIX.length)) + 1) : null))
    const club = { id, ...input, state: { ...founded.state, lineup }, version: 1 }
    save({ club, cards, fixtures: [founded.debut], nextCardId: cards.length + 1 })
    return { club, cards, fixtures: [founded.debut], events: founded.events, now: at, configVersion: config.version }
  },
  setLineup: (formation, lineup) => respond(mock => wrap(() => ({ state: setLineup(mock.club.state, formation, lineup, mock.cards) }))),
  sell: cardId => respond(mock => wrap(() => sellCard(mock.club.state, mock.cards, cardId, players, config))),
  merge: cardIds => respond(mock => wrap(() => mergeInClub(mock.club.state, mock.cards, cardIds, config))),
  train: cardId => respond(mock => wrap(() => trainInClub(mock.club.state, mock.cards, cardId, players, config))),
  openPack: source => respond((_mock, _at, ctx) => wrap(() => openPack(ctx, source))),
  buyPack: () => respond((_mock, _at, ctx) => wrap(() => buyPack(ctx))),
  arcadePack: position => respond((_mock, _at, ctx) => wrap(() => arcadePack(ctx, position))),
  decidePack: decisions => respond((_mock, _at, ctx) => wrap(() => decidePack(ctx, decisions))),
  collectStadium: () => respond((_mock, _at, ctx) => wrap(() => collectStadium(ctx))),
  upgradeStadium: () => respond((_mock, _at, ctx) => wrap(() => upgradeStadium(ctx))),
  collectTray: cabinet => respond((_mock, _at, ctx) => wrap(() => collectTray(ctx, cabinet))),
  startPlay: (cabinet, paid) => respond((_mock, _at, ctx) => wrap(() => startPlay(ctx, cabinet, paid))),
  finishPlay: (cabinet, taps) => respond((_mock, _at, ctx) => wrap(() => finishPlay(ctx, cabinet, taps))),
  startWarmup: () => respond((_mock, _at, ctx) => wrap(() => startWarmup(ctx))),
  finishWarmup: tapMs => respond((_mock, _at, ctx) => wrap(() => finishWarmup(ctx, tapMs))),
  claimGoal: goalId => respond((_mock, _at, ctx) => wrap(() => claimGoal(ctx, goalId))),
  claimFreePack: () => respond((_mock, _at, ctx) => wrap(() => claimFreePack(ctx))),
  claimCalendar: () => respond((_mock, _at, ctx) => wrap(() => claimCalendar(ctx))),
  claimPassTier: (track, tier) => respond((_mock, _at, ctx) => wrap(() => claimPassTier(ctx, track, tier))),
  claimAlbumSet: setId => respond((_mock, _at, ctx) => wrap(() => claimAlbumSet(ctx, setId))),
  readCatalogue: async () => catalogue,
  readConfig: async () => config,
  async readFixtures(limit) {
    return [...(load()?.fixtures ?? [])].sort((a, b) => b.no - a.no).slice(0, limit)
  },
}

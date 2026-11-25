import { DEFAULT_CONFIG, foundClub, generateCatalogue, syncClub } from '@ld/pixel-pitch-core'
import { describe, expect, it } from 'vitest'
import { claimCount, readyItems } from '@/features/game/lib/ready-now'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config, 'pixel-pitch-catalogue')
const founded = foundClub({ clubId: 'ready-1', now: T0, config, catalogue, players: id => catalogue.find(player => player.id === id) })

/** The answer the app holds for a club, as it would be `later` after being founded. */
function game(later = 0, patch: (state: typeof founded.state) => typeof founded.state = state => state) {
  const players = (id: string) => catalogue.find(player => player.id === id)
  const state = later > 0 ? syncClub({ state: founded.state, cards: founded.cards, players, clubId: 'ready-1', config, now: T0 + later }).state : founded.state
  return { now: T0 + later, club: { id: 1, name: 'Ready FC', crest: 0, kitPrimary: '#fff', kitSecondary: '#000', state: patch(state) }, cards: founded.cards, events: [], fixtures: [] } as never
}

describe('what is ready now', () => {
  it('lists the calendar and the free pack for a new club, its starter packs, and the arcade energy to spend', () => {
    const items = readyItems(game(), config, catalogue)
    expect(items.map(item => item.id)).toEqual(['calendar', 'freePack', 'packs', 'arcade'])
    expect(claimCount(items)).toBe(2)
    expect(items.find(item => item.id === 'arcade')!.label).toBe('Arcade: 5 energy to spend')
  })

  it('puts what Claim all takes before what is worth going to do, and grows as time passes', () => {
    const items = readyItems(game(5 * 3_600_000), config, catalogue)
    const ids = items.map(item => item.id)
    expect(ids).toEqual(expect.arrayContaining(['stadium', 'tray', 'calendar', 'freePack', 'packs', 'arcade']))
    const firstDo = items.findIndex(item => !item.claim)
    expect(items.slice(0, firstDo).every(item => item.claim)).toBe(true)
    expect(items.slice(firstDo).every(item => !item.claim)).toBe(true)
    expect(items.find(item => item.id === 'packs')!.label).toMatch(/^\d+ packs? to open$/)
  })

  it('says nothing is ready when everything has been taken and the energy is spent', () => {
    const spent = game(0, state => ({ ...state, idle: { ...state.idle, shelfPacks: 0 }, daily: { ...state.daily, freePackClaimed: true }, calendar: { streak: 1, lastClaimDay: Math.floor(T0 / 86_400_000) }, energy: { fullAt: T0 + 100 * 3_600_000 } }))
    expect(readyItems(spent, config, catalogue)).toEqual([])
  })
})

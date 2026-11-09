import type { FixtureResult, FormationId, GameConfig, GameResponse, NewClub, Player, Position } from '@ld/pixel-pitch-core'

/** Everything the game screens ask the server for. `game.live.ts` calls the api; `game.mock.ts` runs the rules here. */
export interface GameApi {
  /** Catches the club up to now. `null` when the player has not created a club yet. */
  sync: () => Promise<GameResponse | null>
  createClub: (input: NewClub) => Promise<GameResponse>
  setLineup: (formation: FormationId, lineup: Array<string | null>) => Promise<GameResponse>
  sell: (cardId: string) => Promise<GameResponse>
  merge: (cardIds: string[]) => Promise<GameResponse>
  train: (cardId: string) => Promise<GameResponse>
  /** Opens a pack from the shelf or a Star pack. The players wait to be signed or sold. */
  openPack: (source: 'shelf' | 'star') => Promise<GameResponse>
  buyPack: () => Promise<GameResponse>
  arcadePack: (position: Position) => Promise<GameResponse>
  decidePack: (decisions: Array<'sign' | 'sell'>) => Promise<GameResponse>
  readCatalogue: () => Promise<Player[]>
  readConfig: () => Promise<GameConfig>
  /** The club's most recent matches, newest first. */
  readFixtures: (limit: number) => Promise<FixtureResult[]>
}

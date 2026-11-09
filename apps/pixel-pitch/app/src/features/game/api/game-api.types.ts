import type { Cabinet, FixtureResult, FormationId, GameConfig, GameResponse, NewClub, PassTrack, Player, PlayResult, Position, Reward, WarmupZone } from '@ld/pixel-pitch-core'

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
  collectStadium: () => Promise<GameResponse & { coins: number }>
  upgradeStadium: () => Promise<GameResponse & { level: number, cost: number }>
  collectTray: (cabinet: Cabinet) => Promise<GameResponse & { tokens: number }>
  /** Starts a play: the ticket (with the game's seed) is in the answer's club state. `paid` spends gems for an extra play. */
  startPlay: (cabinet: Cabinet, paid: boolean) => Promise<GameResponse>
  /** Sends the taps the game recorded; the server replays them and answers with the score and pay. */
  finishPlay: (cabinet: Cabinet, taps: number[]) => Promise<GameResponse & PlayResult>
  startWarmup: () => Promise<GameResponse>
  finishWarmup: (tapMs: number) => Promise<GameResponse & { zone: WarmupZone, bonus: number }>
  claimGoal: (goalId: string) => Promise<GameResponse & { reward: Reward }>
  claimFreePack: () => Promise<GameResponse & { packs: number }>
  claimCalendar: () => Promise<GameResponse & { day: number, reward: Reward }>
  claimPassTier: (track: PassTrack, tier: number) => Promise<GameResponse & { reward: Reward }>
  claimAlbumSet: (setId: string) => Promise<GameResponse & { reward: Reward }>
  readCatalogue: () => Promise<Player[]>
  readConfig: () => Promise<GameConfig>
  /** The club's most recent matches, newest first. */
  readFixtures: (limit: number) => Promise<FixtureResult[]>
}

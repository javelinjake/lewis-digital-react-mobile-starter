import type { AnyTaps, Cabinet, CabinetTaps, ClaimAllResult, FixtureResult, FormationId, GameConfig, GameResponse, NewClub, PassTrack, Player, PlayResult, Position, Reward, WarmupResult } from '@ld/pixel-pitch-core'

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
  /** Plays a friendly now. The answer's `fixtures` holds it, last. */
  playFriendly: () => Promise<GameResponse & { fixture: FixtureResult }>
  collectStadium: () => Promise<GameResponse & { coins: number }>
  upgradeStadium: () => Promise<GameResponse & { level: number, cost: number }>
  /** Empties the arcade's one token tray. */
  collectTray: () => Promise<GameResponse & { tokens: number }>
  /** Starts a play: the ticket (with the game's seed) is in the answer's club state. `paid` spends gems for an extra play. */
  startPlay: (cabinet: Cabinet, paid: boolean) => Promise<GameResponse>
  /** Sends what the game recorded (its shape depends on the cabinet); the server replays it and answers with the score and pay. */
  finishPlay: <C extends Cabinet>(cabinet: C, taps: CabinetTaps[C]) => Promise<GameResponse & PlayResult>
  /** Starts the warm-up for the next match: the ticket names the arcade game to play (`ticket.cabinet`). Free. */
  startWarmup: () => Promise<GameResponse>
  /** Sends the warm-up game's taps (that cabinet's shape); the server replays them and sets the match's attack bonus. */
  finishWarmup: (taps: AnyTaps) => Promise<GameResponse & WarmupResult>
  /** Takes everything that is waiting (stadium, tray, calendar, free pack, goals, Pass, album) in one call. */
  claimAll: () => Promise<GameResponse & ClaimAllResult>
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

/**
 * Pixel Pitch game rules. Pure TypeScript: no React, Capacitor or Payload, and nothing that reads the clock or a random
 * number on its own. The app uses it for previews and the api for outcomes, so the numbers always match.
 */
export const GAME_ID = 'pixel-pitch'

export { type AlbumSet, albumPower, albumSets, isSetComplete, recordCollected } from './album'
export { type Cabinet, type DailyGoal, type DayCounter, type PackSource, type PendingPack, type Ticket, upgradeState } from './club-state'
export { type CardSource, type FlowContext, type FlowResult, type LedgerEntry } from './flow'
export { CALENDAR_DAYS, claimAlbumSet, claimCalendar, claimFreePack, claimGoal, claimPassTier, nextCalendarDay, type PassTrack } from './flow-rewards'
export { collectTray, finishPlay, finishWarmup, freePlaysLeft, freePlaysPerDay, type PlayResult, startPlay, startWarmup } from './flow-arcade'
export { collectStadium, stadiumStage, upgradeStadium } from './flow-stadium'
export { type Bar, type KeepyResult, type KeepySim, KEEPY_STEPS_PER_SECOND, kickPoints, kickRounds, type KickScore, markerAt, newKeepy, runKeepy, scoreKick, shareOf, stepKeepy, warmupBar, warmupZone } from './minigames'
export { arcadePack, buyPack, type DecideResult, decidePack, NEW_CARD_PREFIX, openPack, usedToday } from './flow-packs'
export { addXp, describeReward, grantReward, maxXp, passTiers, pickGoals, recordProgress, rollDaily, rollSeason, seasonOf, tierReached } from './progress'
export { type CommentaryInput, type CommentaryKind, type CommentaryLine, commentate } from './commentary'
export { type ClubView, CREST_BASES, CREST_COUNT, CREST_EMBLEMS, crestParts, type GameResponse, type NewClub } from './api-types'
export { advance, type AdvanceResult, dayIndex, notificationTimes, pendingStadiumCoins, pendingTrayTokens, shelfCapacity } from './advance'
export { DEFAULT_CONFIG, GOAL_KINDS, type GameConfig, gameConfigSchema, type GoalKind, type GoalDef, parseConfig, type Reward, rewardSchema } from './config'
export { type IdleState, newIdleState, type WelcomeBackEvent } from './state'

export { type CardChange, type ClubState, clubNotificationTimes, foundClub, type FoundedClub, lineupForMatch, mergeInClub, newClubState, playDebut, type PlayerLookup, sellCard, setLineup, syncClub, type SyncResult, trainInClub } from './club'
export { GameRuleError, isGameRuleError } from './errors'
export { cardRating, benchCount, benchHasRoom, MAX_RATING, mergeable, mergeCards, type OwnedCard, sellValue, toFielded, train, trainingCost } from './cards'
export { generateCatalogue, inventName, HAIR_COLOURS, HAIR_STYLES, NATIONS, type Player, SKIN_TONES, type SpriteParts } from './catalogue'
export { autoPick, type AutoPickResult, chemistryBonus, type Fielded, type LineupScore, type PoolPlayer, scoreLineup, SLOT_COUNT, type SlotScore, upgradeDelta, type UpgradeResult } from './lineup'
export { type FixtureResult, formationStrength, generateRivals, type LeagueLabel, type LeagueState, leagueLabel, type LineupForMatch, leagueTable, type MatchSquads, newLeagueState, playDueFixtures, type Rival, type TableRow, tierRating, type CatchUpResult } from './league'
export { bestFormation, type FormationOption } from './counter-pick'
export { expectedGoals, expectedPoints, matchExpectation, type MatchEvent, type MatchEventKind, type MatchInput, matchOdds, type MatchOutcome, type MatchResult, type MatchSide, type Odds, playMatch, type Side, warmupBonus, type WarmupZone } from './match'
export { isStarOrBetter, oddsForTier, type PackRoll, rollPack, type RollPackInput, rollStarterSquad } from './packs'
export { tacticalEdge } from './tactics'
export { FORMATION_IDS, FORMATIONS, type Formation, type FormationId, isFormationId, NATION_COUNT, POSITIONS, positionFit, type Position, type PositionedPlayer, type Rarity, RARITIES, ROLE_WEIGHTS } from './positions'

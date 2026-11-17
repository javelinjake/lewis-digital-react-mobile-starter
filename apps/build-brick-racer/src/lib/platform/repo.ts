import { createKeyValueStorage } from '@ld/native'
import { createIdbStorage } from '@ld/offline'
import { GameRepo } from '@/game/persistence/repo'

let repo: GameRepo | null = null

/** The one local repository. Cars, runs and replays live in IndexedDB; small preferences in Preferences. */
export function getRepo(): GameRepo {
  repo ??= new GameRepo(createIdbStorage('brick-racer'), createKeyValueStorage('brickracer'))
  return repo
}

/** Swap the repository (tests). */
export function setRepo(next: GameRepo | null): void {
  repo = next
}

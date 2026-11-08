import * as migration_20261108_143250_initial from './20261108_143250_initial'
import * as migration_20261108_204346_game from './20261108_204346_game'

export const migrations = [
  {
    up: migration_20261108_143250_initial.up,
    down: migration_20261108_143250_initial.down,
    name: '20261108_143250_initial',
  },
  {
    up: migration_20261108_204346_game.up,
    down: migration_20261108_204346_game.down,
    name: '20261108_204346_game',
  },
]

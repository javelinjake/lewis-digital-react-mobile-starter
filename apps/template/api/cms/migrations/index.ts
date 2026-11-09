import * as migration_20261108_143250_initial from './20261108_143250_initial'

export const migrations = [
  {
    up: migration_20261108_143250_initial.up,
    down: migration_20261108_143250_initial.down,
    name: '20261108_143250_initial',
  },
]

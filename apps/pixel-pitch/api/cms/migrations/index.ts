import * as migration_20261108_143250_initial from './20261108_143250_initial';
import * as migration_20261108_204346_game from './20261108_204346_game';
import * as migration_20261109_000910_commentary from './20261109_000910_commentary';
import * as migration_20261123_214729_ota_bundles from './20261123_214729_ota_bundles';

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
  {
    up: migration_20261109_000910_commentary.up,
    down: migration_20261109_000910_commentary.down,
    name: '20261109_000910_commentary',
  },
  {
    up: migration_20261123_214729_ota_bundles.up,
    down: migration_20261123_214729_ota_bundles.down,
    name: '20261123_214729_ota_bundles'
  },
];

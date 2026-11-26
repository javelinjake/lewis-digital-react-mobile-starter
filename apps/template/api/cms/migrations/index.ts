import * as migration_20261108_143250_initial from './20261108_143250_initial';
import * as migration_20261123_214717_ota_bundles from './20261123_214717_ota_bundles';

export const migrations = [
  {
    up: migration_20261108_143250_initial.up,
    down: migration_20261108_143250_initial.down,
    name: '20261108_143250_initial',
  },
  {
    up: migration_20261123_214717_ota_bundles.up,
    down: migration_20261123_214717_ota_bundles.down,
    name: '20261123_214717_ota_bundles'
  },
];

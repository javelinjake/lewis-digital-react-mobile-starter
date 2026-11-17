import type { ChallengeDefinition } from './types'
import { GARDEN, GARDEN_VERSION } from '../env/garden'
import { gate, spawn, zone } from './util'

const ENV = { environment: 'garden' as const, environmentVersion: GARDEN_VERSION }
const hillY = (z: number) => ((z - GARDEN.hill.startZ) / (GARDEN.hill.endZ - GARDEN.hill.startZ)) * GARDEN.hill.top

export const gardenMud: ChallengeDefinition = {
  id: 'garden_mud',
  version: 1,
  ...ENV,
  name: 'Garden Mud Run',
  shortName: 'Mud Run',
  objective: 'Cross the muddy sections and reach the finish.',
  tagline: 'Cross the mud',
  powerMode: 'motor',
  start: { position: [0, 0, 0], yaw: 0 },
  spawnClearance: spawn(0, 0, 0),
  gates: [
    gate('before-mud', 'checkpoint', 0, 0, 8, 3.6),
    gate('after-mud', 'checkpoint', 0, 0, 28, 3.8),
    gate('second-patch', 'checkpoint', 2.4, 0, 44, 3.4),
    gate('finish', 'finish', 0, 0, 58, 3.8),
  ],
  outOfBounds: [],
  rule: { kind: 'gate_race' },
  metrics: { primary: 'time', secondary: ['peakSpeed', 'progress'] },
  thresholds: { great: 16 },
  timeLimit: 90,
  markers: [
    { kind: 'cones', points: [[-4.8, 0, 11], [4.8, 0, 11], [-4.8, 0, 27], [4.8, 0, 27]], colour: '#ff7a1a' },
  ],
}

export const gardenClimb: ChallengeDefinition = {
  id: 'garden_climb',
  version: 1,
  ...ENV,
  name: 'Garden Hill Climb',
  shortName: 'Hill Climb',
  objective: 'Drive up the soil hill through the gates to the top.',
  tagline: 'Reach the top',
  powerMode: 'motor',
  start: { position: [GARDEN.hill.x, 0, 0], yaw: 0 },
  spawnClearance: spawn(GARDEN.hill.x, 0, 0),
  gates: [
    gate('hill-low', 'checkpoint', GARDEN.hill.x, hillY(12), 12, 2.8),
    gate('hill-high', 'checkpoint', GARDEN.hill.x, hillY(16), 16, 2.8),
    gate('hill-top', 'finish', GARDEN.hill.x, GARDEN.hill.top, 26, 2.8),
  ],
  outOfBounds: [],
  rule: { kind: 'gate_race' },
  metrics: { primary: 'time', secondary: ['progress', 'peakSpeed'] },
  thresholds: { great: 9 },
  timeLimit: 60,
  markers: [],
}

export const gardenJump: ChallengeDefinition = {
  id: 'garden_jump',
  version: 1,
  ...ENV,
  name: 'Garden Plank Jump',
  shortName: 'Plank Jump',
  objective: 'Race up the plank, fly, and land on your wheels.',
  tagline: 'Land on your wheels',
  powerMode: 'motor',
  start: { position: [GARDEN.plank.x, 0, 0], yaw: 0 },
  spawnClearance: spawn(GARDEN.plank.x, 0, 0),
  gates: [],
  outOfBounds: [],
  rule: { kind: 'jump', takeoff: zone(GARDEN.plank.x, GARDEN.plank.top, GARDEN.plank.endZ - 0.4, 2, 1.5, 1.4), landingHold: 1 },
  metrics: { primary: 'jumpDistance', secondary: ['peakSpeed'] },
  thresholds: { great: 1.6 },
  timeLimit: 40,
  markers: [
    { kind: 'cones', points: [[-17, 0, 25.6], [-11, 0, 25.6], [-17, 0, 27.6], [-11, 0, 27.6], [-17, 0, 29.6], [-11, 0, 29.6], [-17, 0, 31.6], [-11, 0, 31.6], [-17, 0, 33.6], [-11, 0, 33.6]], colour: '#ffd21f' },
  ],
}

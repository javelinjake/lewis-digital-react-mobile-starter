import type { ChallengeDefinition } from './types'
import { DRIFT_CORNER, KITCHEN, KITCHEN_VERSION } from '../env/kitchen'
import { gate, spawn, zone } from './util'

const ENV = { environment: 'kitchen' as const, environmentVersion: KITCHEN_VERSION }

/** Surface height of the ramp centre line at a given z. */
const rampY = (z: number) => KITCHEN.boardTop * (1 - (z - KITCHEN.rampStartZ) / (KITCHEN.rampEndZ - KITCHEN.rampStartZ))

export const kitchenSprint: ChallengeDefinition = {
  id: 'kitchen_sprint',
  version: 1,
  ...ENV,
  name: 'Kitchen Ramp Run',
  shortName: 'Ramp Run',
  objective: 'Roll down the ramp and steer through the gates to the finish.',
  tagline: 'Roll to the finish',
  powerMode: 'gravity',
  start: { position: [0, KITCHEN.boardTop, 3.7], yaw: 0 },
  spawnClearance: spawn(0, KITCHEN.boardTop, 1.5, 0, 1.7, 2.6),
  gates: [
    gate('ramp-mid', 'checkpoint', 0, rampY(10.5), 10.5, 1.8),
    gate('ramp-end', 'checkpoint', 0, 0, 18.8, 2.2),
    gate('bend-right', 'checkpoint', 1.2, 0, 24, 2.4),
    gate('bend-left', 'checkpoint', -1.2, 0, 29, 2.4),
    gate('finish', 'finish', 0, 0, 34, 2.8),
  ],
  outOfBounds: [],
  rule: { kind: 'gate_race' },
  metrics: { primary: 'time', secondary: ['peakSpeed'] },
  thresholds: { great: 10.8 },
  timeLimit: 45,
  markers: [
    { kind: 'cones', points: [[3.7, 0, 24], [-1.3, 0, 24], [1.3, 0, 29], [-3.7, 0, 29]], colour: '#ff7a1a' },
  ],
}

export const kitchenAcceleration: ChallengeDefinition = {
  id: 'kitchen_acceleration',
  version: 1,
  ...ENV,
  name: 'Kitchen Quick Start',
  shortName: 'Quick Start',
  objective: 'Floor it from a standing start and reach the target speed as fast as you can.',
  tagline: 'Get up to speed',
  powerMode: 'motor',
  start: { position: [9, 0, 1], yaw: 0 },
  spawnClearance: spawn(9, 0, 1),
  gates: [],
  outOfBounds: [],
  rule: { kind: 'target_speed', targetSpeed: 4, hold: 0.25 },
  metrics: { primary: 'accelTime', secondary: ['peakSpeed'] },
  thresholds: { great: 1.7 },
  timeLimit: 15,
  markers: [{ kind: 'lane', zone: zone(9, 0.02, 14, 1.5, 0.02, 14), colour: '#ffffff', label: 'GO' }],
}

export const kitchenBraking: ChallengeDefinition = {
  id: 'kitchen_braking',
  version: 1,
  ...ENV,
  name: 'Kitchen Stop Box',
  shortName: 'Stop Box',
  objective: 'Enter the box at the marked speed, then brake and stop inside it.',
  tagline: 'Stop in the box',
  powerMode: 'motor',
  start: { position: [-9, 0, 0], yaw: 0 },
  spawnClearance: spawn(-9, 0, 0),
  gates: [gate('box-entry', 'entry', -9, 0, 16, 1.6, 0, 'Enter at speed')],
  outOfBounds: [],
  rule: { kind: 'brake_test', targetEntrySpeed: 3.2, tolerance: 0.1, lane: zone(-9, 0.5, 26, 1.6, 1.5, 10), stopSpeed: 0.08, stopHold: 0.4 },
  metrics: { primary: 'stoppingDistance', secondary: ['entrySpeed'] },
  thresholds: { great: 0.75 },
  timeLimit: 25,
  markers: [
    { kind: 'lane', zone: zone(-9, 0.02, 26, 1.6, 0.02, 10), colour: '#ffd21f', label: 'STOP BOX' },
    { kind: 'cones', points: [[-10.8, 0, 16], [-7.2, 0, 16]], colour: '#ff7a1a' },
  ],
}

const corner = DRIFT_CORNER
export const kitchenDrift: ChallengeDefinition = {
  id: 'kitchen_drift',
  version: 1,
  ...ENV,
  name: 'Kitchen Slide Corner',
  shortName: 'Slide Corner',
  objective: 'Power into the wide corner and slide through it. Keep it sideways to score.',
  tagline: 'Slide the corner',
  powerMode: 'motor',
  start: { position: [0, 0, corner.startZ], yaw: 0 },
  spawnClearance: spawn(0, 0, corner.startZ),
  gates: [
    gate('corner-entry', 'entry', 0, 0, 56, 5, 0, 'Corner'),
    gate('corner-exit', 'finish', -18, 0, 66, 5, -Math.PI / 2, 'Exit'),
  ],
  outOfBounds: [],
  rule: {
    kind: 'drift',
    zone: { centre: corner.centre, inner: corner.inner, outer: corner.outer, startAngle: 0, endAngle: Math.PI / 2 + 0.15 },
    minSpeed: 1.2,
    slipMinDeg: 10,
    slipMaxDeg: 45,
    minContinuous: 0.5,
  },
  metrics: { primary: 'driftScore', secondary: ['peakSpeed'] },
  thresholds: { great: 15 },
  timeLimit: 30,
  markers: [
    { kind: 'arc', centre: corner.centre, radius: corner.inner, start: 0, end: Math.PI / 2, y: 0.03, colour: '#ffffff' },
    { kind: 'arc', centre: corner.centre, radius: (corner.inner + corner.outer) / 2, start: 0, end: Math.PI / 2, y: 0.03, colour: '#ffd21f' },
    { kind: 'cones', points: [[-5, 0, 56], [-8, 0, 60.5], [-12, 0, 60.5], [-13.5, 0, 56.5]], colour: '#ff7a1a' },
  ],
}

export const kitchenCoast: ChallengeDefinition = {
  id: 'kitchen_coast',
  version: 1,
  ...ENV,
  name: 'Kitchen Coast Test',
  shortName: 'Coast Test',
  objective: 'Reach the marked speed at the first gate. The motor cuts off there. See how fast you are going at the end.',
  tagline: 'Coast the straight',
  powerMode: 'motor',
  start: { position: [-15, 0, 0], yaw: 0 },
  spawnClearance: spawn(-15, 0, 0),
  gates: [
    gate('coast-entry', 'entry', -15, 0, 14, 1.6, 0, 'Motor stops'),
    gate('coast-measure', 'measure', -15, 0, 28, 1.6, 0, 'Measure'),
  ],
  outOfBounds: [],
  rule: { kind: 'coast', targetEntrySpeed: 4, tolerance: 0.1 },
  metrics: { primary: 'exitSpeed', secondary: ['entrySpeed'] },
  thresholds: { great: 1.8 },
  timeLimit: 30,
  markers: [
    { kind: 'lane', zone: zone(-15, 0.02, 14, 1.6, 0.02, 14), colour: '#ffffff' },
    { kind: 'lane', zone: zone(-15, 0.025, 28, 1.6, 0.02, 0.4), colour: '#2a7bd6', label: 'MEASURE' },
  ],
}

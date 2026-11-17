/**
 * Kitchen: a giant domestic kitchen. A raised chopping board feeds a broad orange toy-track ramp
 * down to the tile floor. The floor holds the sprint straight, an acceleration lane, a stop-box
 * lane, a coast lane and a wide drift corner. Props are oversized to communicate scale.
 */
import type { DecoProp, EnvironmentDefinition, StaticBox } from './types'
import { qFromEuler } from '../math'
import { flat, rail, ramp, solid } from './dsl'

export const KITCHEN_VERSION = 1

/** Heights and key positions shared with the challenge definitions. */
export const KITCHEN = {
  boardTop: 2.6,
  rampStartZ: 3.5,
  rampEndZ: 18,
  floor: { x0: -34, x1: 16, z0: -8, z1: 92 },
} as const

const cabinet = { material: 'cabinet' as const, colour: '#c98b55' }
const trackLook = { material: 'plastic' as const, colour: '#ff7a1a' }
const railLook = { material: 'plastic' as const, colour: '#2a7bd6' }

/** Foam barrier segments along an arc so the drift corner has a physical outer edge. */
export function arcBarrier(prefix: string, cx: number, cz: number, radius: number, a0: number, a1: number, segments: number): StaticBox[] {
  const out: StaticBox[] = []
  const step = (a1 - a0) / segments
  const len = 2 * radius * Math.sin(step / 2)
  for (let i = 0; i < segments; i++) {
    const a = a0 + step * (i + 0.5)
    out.push({
      id: `${prefix}-${i}`,
      centre: [cx + radius * Math.cos(a), 0.4, cz + radius * Math.sin(a)],
      half: [0.3, 0.4, len / 2 + 0.05],
      rot: qFromEuler(0, -a),
      surface: 'plastic',
      kind: 'wall',
      look: { material: 'plastic', colour: '#e3342f' },
    })
  }
  return out
}

/** Drift corner geometry shared with the Slide Corner challenge. */
export const DRIFT_CORNER = { centre: [-10, 56] as [number, number], inner: 5, outer: 15, startZ: 44 } as const

function boxes(): StaticBox[] {
  const f = KITCHEN.floor
  const top = KITCHEN.boardTop
  const rampFrom: [number, number, number] = [0, top, KITCHEN.rampStartZ]
  const rampTo: [number, number, number] = [0, 0, KITCHEN.rampEndZ]
  return [
    flat('floor', f.x0, f.x1, f.z0, f.z1, 0, 'tile', { material: 'tile', colour: '#e8edf3' }, 1),
    // Boundary cabinets keep the car in the room.
    solid('wall-left', [f.x0 - 1, -1, f.z0 - 1], [f.x0, 4, f.z1 + 1], 'wall', 'tile', cabinet),
    solid('wall-right', [f.x1, -1, f.z0 - 1], [f.x1 + 1, 4, f.z1 + 1], 'wall', 'tile', cabinet),
    solid('wall-back', [f.x0, -1, f.z0 - 1], [f.x1, 4, f.z0], 'wall', 'tile', cabinet),
    solid('wall-front', [f.x0, -1, f.z1], [f.x1, 4, f.z1 + 1], 'wall', 'tile', cabinet),
    // Chopping board on a stack of cookbooks.
    solid('board', [-1.8, 0, -4], [1.8, top, KITCHEN.rampStartZ], 'ground', 'wood', { material: 'wood', colour: '#d9a066' }),
    solid('board-rail-back', [-1.9, top, -4.2], [1.9, top + 0.3, -4], 'wall', 'wood', railLook),
    solid('board-rail-left', [-2.0, top, -4], [-1.8, top + 0.3, KITCHEN.rampStartZ], 'wall', 'wood', railLook),
    solid('board-rail-right', [1.8, top, -4], [2.0, top + 0.3, KITCHEN.rampStartZ], 'wall', 'wood', railLook),
    // Broad toy-track ramp.
    ramp('ramp', rampFrom, rampTo, 3.6, 0.3, 'plastic', trackLook),
    rail('ramp-rail-left', rampFrom, rampTo, -1.9, 0.3, railLook),
    rail('ramp-rail-right', rampFrom, rampTo, 1.9, 0.3, railLook),
    // Oversized obstacles that make the room feel big and give free drive something to bump.
    solid('leg-1', [-31, 0, 22], [-27, 12, 26], 'prop', 'tile', { material: 'wood', colour: '#b9763c' }),
    solid('leg-2', [-31, 0, 40], [-27, 12, 44], 'prop', 'tile', { material: 'wood', colour: '#b9763c' }),
    solid('mug', [11, 0, 14], [14, 3, 17], 'prop', 'tile', { material: 'ceramic', colour: '#ffffff' }),
    solid('flour-bag', [-12, 0, 84], [-8, 3.2, 87], 'prop', 'tile', { material: 'plain', colour: '#f6f0e6' }),
    solid('dish-rack', [8, 0, 70], [14, 2.4, 76], 'prop', 'tile', { material: 'metal', colour: '#cfd6dd' }),
    solid('stool', [-24, 0, 70], [-20, 3, 74], 'prop', 'tile', { material: 'wood', colour: '#a85f2b' }),
    // Drift corner: side barriers on the approach, a curved outer barrier and an end wall.
    solid('drift-approach-right', [4.6, 0, 44], [5.0, 0.8, 56], 'wall', 'plastic', { material: 'plastic', colour: '#e3342f' }),
    ...arcBarrier('drift-outer', DRIFT_CORNER.centre[0], DRIFT_CORNER.centre[1], DRIFT_CORNER.outer + 1.5, -0.05, Math.PI / 2 + 0.05, 9),
    solid('drift-exit-outer', [-30, 0, 71.3], [-10, 0.8, 71.8], 'wall', 'plastic', { material: 'plastic', colour: '#e3342f' }),
    solid('drift-exit-end', [-30.6, 0, 60], [-30, 0.8, 72], 'wall', 'plastic', { material: 'plastic', colour: '#e3342f' }),
  ]
}

function props(): DecoProp[] {
  const out: DecoProp[] = [
    { id: 'books-1', shape: 'box', centre: [-2.3, 0.4, 0.2], size: [0.9, 0.8, 5], colour: '#2d6cdf' },
    { id: 'mug-handle', shape: 'cylinder', centre: [14.6, 1.6, 15.5], size: [1.6, 0.35, 1.6], rot: qFromEuler(0, 0, Math.PI / 2), colour: '#ffffff' },
    { id: 'whisk-1', shape: 'cylinder', centre: [3.4, 0.2, 52], size: [0.35, 6, 0.35], rot: qFromEuler(0, 0.4, Math.PI / 2), colour: '#cfd6dd' },
    { id: 'wooden-spoon', shape: 'cylinder', centre: [-6, 0.18, 30], size: [0.3, 7, 0.3], rot: qFromEuler(0, 1.1, Math.PI / 2), colour: '#d9a066' },
    { id: 'spoon-bowl', shape: 'sphere', centre: [-9.4, 0.15, 33.1], size: [1.4, 0.4, 1.4], colour: '#d9a066' },
    { id: 'tomato-1', shape: 'sphere', centre: [5, 0.6, 62], size: [1.2, 1.2, 1.2], colour: '#e3342f' },
    { id: 'tomato-2', shape: 'sphere', centre: [6.4, 0.5, 63.1], size: [1.0, 1.0, 1.0], colour: '#e3342f' },
    { id: 'lemon-1', shape: 'sphere', centre: [-14, 0.5, 18], size: [1.1, 0.9, 1.1], colour: '#ffd21f' },
    { id: 'pot-lid', shape: 'cylinder', centre: [-20, 0.1, 55], size: [4.5, 0.2, 4.5], colour: '#cfd6dd' },
    { id: 'rolling-pin', shape: 'cylinder', centre: [12, 0.5, 40], size: [1, 6, 1], rot: qFromEuler(0, 0.2, Math.PI / 2), colour: '#e8c28b' },
  ]
  // Cabinet doors and a window along the far wall for depth.
  for (let i = 0; i < 6; i++) {
    out.push({ id: `door-${i}`, shape: 'box', centre: [-34 + 0.1, 1.5, 5 + i * 15], size: [0.1, 2.4, 6], colour: i % 2 ? '#e3a15d' : '#d28f4e' })
  }
  out.push({ id: 'window', shape: 'box', centre: [-33.8, 3.2, 40], size: [0.1, 1.2, 12], colour: '#bfe6ff' })
  // Table legs rising to a ceiling-less tabletop edge.
  out.push({ id: 'table-top-edge', shape: 'box', centre: [-29, 12.5, 33], size: [5, 1, 24], colour: '#9a5a26' })
  return out
}

export const kitchen: EnvironmentDefinition = {
  id: 'kitchen',
  version: KITCHEN_VERSION,
  label: 'Kitchen',
  boxes: boxes(),
  props: props(),
  sky: { top: '#bfe3ff', bottom: '#fff2dc' },
  fogColour: '#fdf1dc',
  fogFar: 140,
  killY: -4,
  cameraVolumes: [
    { min: [-4, -1, -5], max: [4, 4, 14], preset: 'high' },
    { min: [-4, -1, 14], max: [4, 4, 44], preset: 'chase' },
    { min: [-34, -1, 44], max: [16, 4, 92], preset: 'high' },
    { min: [6, -1, -2], max: [12, 4, 30], preset: 'close' },
  ],
  replayShots: [
    { id: 'ramp-low', position: [3.2, 0.5, 14], target: [0, 0.5, 10], near: 'any' },
    { id: 'floor-side', position: [6, 1.2, 26], target: [0, 0.3, 26], near: 'finish' },
    { id: 'corner', position: [-2, 3.5, 64], target: [-10, 0.3, 60], near: 'corner' },
  ],
}

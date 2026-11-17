/**
 * Garden: grass with a muddy strip, a soil hill, and a broad wooden plank jump. The route is kept
 * readable by material contrast (brown mud and soil against green grass, pale planks).
 */
import type { DecoProp, EnvironmentDefinition, StaticBox } from './types'
import { qFromEuler } from '../math'
import { flat, rail, ramp, solid } from './dsl'

export const GARDEN_VERSION = 1

export const GARDEN = {
  area: { x0: -30, x1: 30, z0: -12, z1: 132 },
  mud: { depth: 0.04 },
  hill: { x: 14, startZ: 8, endZ: 19.2, top: 2.8 },
  plank: { x: -14, startZ: 20, endZ: 23.6, top: 0.8 },
} as const

const grass = { material: 'grass' as const, colour: '#5cae3f' }
const mud = { material: 'mud' as const, colour: '#6b4423' }
const soil = { material: 'soil' as const, colour: '#7a5230' }
const plank = { material: 'wood' as const, colour: '#e0b87a' }
const fence = { material: 'wood' as const, colour: '#b98a55' }

function boxes(): StaticBox[] {
  const a = GARDEN.area
  const d = GARDEN.mud.depth
  const list: StaticBox[] = [
    // Boundary fence.
    solid('fence-left', [a.x0 - 1, -1, a.z0 - 1], [a.x0, 3, a.z1 + 1], 'wall', 'grass', fence),
    solid('fence-right', [a.x1, -1, a.z0 - 1], [a.x1 + 1, 3, a.z1 + 1], 'wall', 'grass', fence),
    solid('fence-back', [a.x0, -1, a.z0 - 1], [a.x1, 3, a.z0], 'wall', 'grass', fence),
    solid('fence-front', [a.x0, -1, a.z1], [a.x1, 3, a.z1 + 1], 'wall', 'grass', fence),
    // Main lawn, cut around the mud trenches so surfaces are authored geometry.
    flat('lawn-a', a.x0, a.x1, a.z0, 12, 0, 'grass', grass),
    flat('lawn-b-left', a.x0, -4.5, 12, 26, 0, 'grass', grass),
    flat('lawn-b-right', 4.5, a.x1, 12, 26, 0, 'grass', grass),
    flat('mud-1', -4.5, 4.5, 12, 26, -d, 'mud', mud),
    flat('lawn-c', a.x0, a.x1, 26, 34, 0, 'grass', grass),
    flat('lawn-d-left', a.x0, 0, 34, 40, 0, 'grass', grass),
    flat('lawn-d-right', 4.5, a.x1, 34, 40, 0, 'grass', grass),
    flat('mud-2', 0, 4.5, 34, 40, -d, 'mud', mud),
    flat('lawn-e', a.x0, a.x1, 40, a.z1, 0, 'grass', grass),
  ]

  const h = GARDEN.hill
  const hillFrom: [number, number, number] = [h.x, 0, h.startZ]
  const hillTo: [number, number, number] = [h.x, h.top, h.endZ]
  list.push(
    ramp('hill', hillFrom, hillTo, 6, 0.8, 'grass', soil),
    rail('hill-rail-left', hillFrom, hillTo, -3.1, 0.35, fence),
    rail('hill-rail-right', hillFrom, hillTo, 3.1, 0.35, fence),
    solid('hill-top', [h.x - 3, 0, h.endZ - 0.02], [h.x + 3, h.top, h.endZ + 12], 'ground', 'grass', { material: 'grass', colour: '#6bbd46' }),
    solid('hill-top-rail-left', [h.x - 3.2, h.top, h.endZ], [h.x - 3, h.top + 0.35, h.endZ + 12], 'wall', 'grass', fence),
    solid('hill-top-rail-right', [h.x + 3, h.top, h.endZ], [h.x + 3.2, h.top + 0.35, h.endZ + 12], 'wall', 'grass', fence),
    solid('hill-top-end', [h.x - 3, h.top, h.endZ + 12], [h.x + 3, h.top + 0.6, h.endZ + 12.4], 'wall', 'grass', fence),
  )

  const p = GARDEN.plank
  const plankFrom: [number, number, number] = [p.x, 0, p.startZ]
  const plankTo: [number, number, number] = [p.x, p.top, p.endZ]
  list.push(
    ramp('plank', plankFrom, plankTo, 4, 0.25, 'wood', plank),
    solid('plank-support', [p.x - 2, 0, p.endZ - 1.2], [p.x + 2, p.top - 0.8, p.endZ], 'prop', 'wood', { material: 'plain', colour: '#30b9a6' }),
  )

  // Rocks, pots and a bench stay clear of the routes but are solid.
  list.push(
    solid('pot-1', [-24, 0, 20], [-20, 3, 24], 'prop', 'grass', { material: 'ceramic', colour: '#c8663a' }),
    solid('pot-2', [20, 0, 40], [24, 3.2, 44], 'prop', 'grass', { material: 'ceramic', colour: '#c8663a' }),
    solid('rock-1', [-8, 0, 30], [-6, 1, 32], 'prop', 'grass', { material: 'plain', colour: '#8d949c' }),
    solid('rock-2', [8.5, 0, 46], [10.5, 0.9, 48], 'prop', 'grass', { material: 'plain', colour: '#8d949c' }),
    solid('bench', [-8, 0, 70], [-2, 1.4, 72], 'prop', 'grass', fence),
  )
  return list
}

function props(): DecoProp[] {
  const out: DecoProp[] = [
    { id: 'watering-can', shape: 'cylinder', centre: [-26, 1.4, 6], size: [3, 2.8, 3], colour: '#9aa5b1' },
    { id: 'spout', shape: 'cylinder', centre: [-24.2, 2.4, 6], size: [0.5, 2.8, 0.5], rot: qFromEuler(0, 0, -0.9), colour: '#9aa5b1' },
    { id: 'tree-trunk', shape: 'cylinder', centre: [24, 4, 90], size: [2, 8, 2], colour: '#7a5230' },
    { id: 'tree-top', shape: 'sphere', centre: [24, 10, 90], size: [10, 8, 10], colour: '#2f8f3a' },
    { id: 'bush-1', shape: 'sphere', centre: [-24, 1.2, 60], size: [5, 2.8, 5], colour: '#3da145' },
    { id: 'bush-2', shape: 'sphere', centre: [22, 1.2, 70], size: [5, 2.8, 5], colour: '#3da145' },
  ]
  const flowers = ['#8b5cf6', '#ff6fb5', '#ffd21f', '#ffffff']
  for (let i = 0; i < 22; i++) {
    const x = (i % 2 ? 1 : -1) * (7 + ((i * 53) % 17))
    const z = 2 + ((i * 29) % 110)
    out.push(
      { id: `stem-${i}`, shape: 'cylinder', centre: [x, 0.5, z], size: [0.1, 1, 0.1], colour: '#2f8f3a' },
      { id: `bloom-${i}`, shape: 'sphere', centre: [x, 1.1, z], size: [0.7, 0.4, 0.7], colour: flowers[i % flowers.length]! },
    )
  }
  // Wooden planks painted beside the mud so the route reads.
  out.push(
    { id: 'mud-sign', shape: 'box', centre: [-5.2, 0.5, 11], size: [0.15, 1, 1.2], colour: '#e0b87a' },
    { id: 'jump-sign', shape: 'box', centre: [-17, 0.5, 12], size: [0.15, 1, 1.2], colour: '#e0b87a' },
  )
  return out
}

export const garden: EnvironmentDefinition = {
  id: 'garden',
  version: GARDEN_VERSION,
  label: 'Garden',
  boxes: boxes(),
  props: props(),
  sky: { top: '#7cc4ff', bottom: '#e6f6ff' },
  fogColour: '#e4f3ff',
  fogFar: 150,
  killY: -4,
  cameraVolumes: [
    { min: [-6, -1, -12], max: [6, 4, 60], preset: 'chase' },
    { min: [8, -1, -12], max: [20, 8, 40], preset: 'high' },
    { min: [-20, -1, -12], max: [-8, 5, 40], preset: 'close' },
  ],
  replayShots: [
    { id: 'mud-side', position: [8, 1.4, 19], target: [0, 0.2, 19], near: 'mud' },
    { id: 'jump-low', position: [-10, 0.5, 24], target: [-14, 1.3, 18], near: 'jump' },
    { id: 'hill-top', position: [18, 4.5, 24], target: [14, 3.4, 16], near: 'finish' },
  ],
}

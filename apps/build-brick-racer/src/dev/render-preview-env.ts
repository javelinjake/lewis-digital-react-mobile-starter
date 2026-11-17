import type { EditContext } from '@/game/build/doc'
/** Environment scenes for the render preview (fake environments; the real ones live in src/game/env). */
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { EnvironmentDefinition, StaticBox } from '@/game/env/types'
import type { SceneKit } from '@/render'
import * as THREE from 'three'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { qFromEuler } from '@/game/math'
import { compileVehicle } from '@/game/vehicle/compile'
import { buildDrivingCarModel, buildEnvironment } from '@/render'

const deg = (d: number) => (d * Math.PI) / 180

function box(id: string, centre: [number, number, number], half: [number, number, number], surface: StaticBox['surface'], look: StaticBox['look'], kind: StaticBox['kind'] = 'ground', pitch = 0, yaw = 0): StaticBox {
  return { id, centre, half, surface, kind, look, rot: qFromEuler(pitch, yaw) }
}

export function fakeKitchen(): EnvironmentDefinition {
  return {
    id: 'kitchen',
    version: 0,
    label: 'Kitchen (preview)',
    boxes: [
      box('floor', [0, -0.25, 15], [20, 0.25, 30], 'tile', { material: 'tile', colour: '#ffffff' }),
      box('board', [0, 1.35, -2], [2, 0.25, 4], 'wood', { material: 'wood', colour: '#ffffff' }),
      box('ramp', [0, 0.8, 6.3], [1.6, 0.05, 4.8], 'plastic', { material: 'plastic', colour: '#ff9a3c' }, 'ground', deg(9.6)),
      box('wallL', [-12, 2, 15], [0.5, 2, 24], 'tile', { material: 'cabinet', colour: '#f7ead0' }, 'wall'),
      box('wallBack', [0, 2.5, 38], [20, 2.5, 0.5], 'tile', { material: 'cabinet', colour: '#5ac4ba' }, 'wall'),
      box('leg', [8, 3, 8], [0.7, 3, 0.7], 'wood', { material: 'wood', colour: '#c89a62' }, 'prop'),
    ],
    props: [
      { id: 'mug', shape: 'cylinder', centre: [-5, 0.6, 12], size: [1.6, 1.2, 1.6], colour: '#ff7a1a' },
      { id: 'mugRim', shape: 'cylinder', centre: [-5, 1.2, 12], size: [1.3, 0.06, 1.3], colour: '#fff3e0' },
      { id: 'bowl', shape: 'sphere', centre: [6, 0.9, 16], size: [2.2, 2.2, 2.2], colour: '#2f7bd6' },
      { id: 'spoon', shape: 'box', centre: [-8, 0.08, 20], size: [0.5, 0.16, 4.5], colour: '#b8bec6' },
      { id: 'cone', shape: 'cone', centre: [3, 0.6, 24], size: [1, 1.2, 1], colour: '#e3342f' },
    ],
    sky: { top: '#a9d4f5', bottom: '#f4ecd8' },
    fogColour: '#efe6d2',
    fogFar: 90,
    cameraVolumes: [],
    replayShots: [],
    killY: -10,
  }
}

export function fakeGarden(): EnvironmentDefinition {
  return {
    id: 'garden',
    version: 0,
    label: 'Garden (preview)',
    boxes: [
      box('grass', [0, -0.25, 20], [24, 0.25, 40], 'grass', { material: 'grass', colour: '#ffffff' }),
      box('mud', [0, -0.247, 8], [4, 0.25, 6], 'mud', { material: 'mud', colour: '#ffffff' }),
      box('bank', [11, 0.9, 12], [3, 0.2, 6], 'grass', { material: 'soil', colour: '#ffffff' }, 'ground', deg(-16)),
      box('plank', [-9, 0.55, 14], [1.6, 0.06, 2.4], 'wood', { material: 'wood', colour: '#ffffff' }, 'ground', deg(-14)),
      box('fence', [0, 1, 40], [24, 1, 0.2], 'wood', { material: 'wood', colour: '#e8d2a8' }, 'wall'),
      box('pot', [-15, 1.2, 20], [1.6, 1.2, 1.6], 'tile', { material: 'ceramic', colour: '#c8643a' }, 'prop'),
    ],
    props: [
      { id: 's1', shape: 'sphere', centre: [4, 0.5, 24], size: [1.2, 1, 1.1], colour: '#8a8f96' },
      { id: 's2', shape: 'sphere', centre: [-6, 0.4, 26], size: [1, 0.8, 0.9], colour: '#9aa0a8' },
      { id: 'flower', shape: 'sphere', centre: [-4, 1.3, 30], size: [0.7, 0.7, 0.7], colour: '#ffd21f' },
      { id: 'stem', shape: 'cylinder', centre: [-4, 0.65, 30], size: [0.1, 1.3, 0.1], colour: '#2fbf4a' },
      { id: 'water', shape: 'cylinder', centre: [14, 1, 28], size: [2, 2, 2], colour: '#7da0b8' },
    ],
    sky: { top: '#7cc0f2', bottom: '#dff2ff' },
    fogColour: '#d6ecfb',
    fogFar: 110,
    cameraVolumes: [],
    replayShots: [],
    killY: -10,
  }
}

export function fakeChallenge(): ChallengeDefinition {
  return {
    id: 'kitchen_braking',
    version: 0,
    environment: 'kitchen',
    environmentVersion: 0,
    name: 'Preview',
    shortName: 'Preview',
    objective: '',
    tagline: '',
    powerMode: 'motor',
    start: { position: [0, 0, 12], yaw: 0 },
    spawnClearance: { centre: [0, 0.3, 12], half: [1, 0.5, 1], yaw: 0 },
    gates: [
      { id: 'g1', kind: 'checkpoint', centre: [0, 0.5, 16], yaw: 0, halfWidth: 1.8, halfHeight: 0.5 },
      { id: 'g2', kind: 'entry', centre: [0, 0.5, 19], yaw: 0, halfWidth: 1.8, halfHeight: 0.5 },
      { id: 'g3', kind: 'measure', centre: [0, 0.5, 22], yaw: 0, halfWidth: 1.8, halfHeight: 0.5 },
      { id: 'g4', kind: 'motor_cut', centre: [0, 0.5, 25], yaw: 0, halfWidth: 1.8, halfHeight: 0.5 },
      { id: 'g5', kind: 'finish', centre: [0, 0.7, 28], yaw: 0, halfWidth: 2, halfHeight: 0.7 },
    ],
    outOfBounds: [],
    rule: { kind: 'gate_race' },
    metrics: { primary: 'time', secondary: [] },
    thresholds: { great: 10 },
    timeLimit: 60,
    markers: [
      { kind: 'lane', zone: { centre: [-6, 0, 18], half: [1.4, 0.1, 5], yaw: 0 }, colour: '#ffd21f', label: 'Stop box' },
      { kind: 'cones', points: [[2.4, 0, 14], [2.4, 0, 16], [2.4, 0, 18], [-2.4, 0, 14], [-2.4, 0, 16], [-2.4, 0, 18]], colour: '#ff7a1a' },
      { kind: 'arc', centre: [-10, 31], radius: 8, start: 0, end: Math.PI / 2, y: 0, colour: '#ffffff' },
    ],
  }
}

export function installEnvScenes(
  name: string,
  kit: SceneKit,
  frame: (min: THREE.Vector3, max: THREE.Vector3) => void,
  setAngles: (a: { yaw: number, pitch: number }) => void,
  ctx: EditContext,
  params: URLSearchParams,
): boolean {
  if (name !== 'kitchen' && name !== 'garden')
    return false
  const env = name === 'kitchen' ? fakeKitchen() : fakeGarden()
  const challenge = name === 'kitchen' ? fakeChallenge() : undefined
  const built = buildEnvironment(env, challenge)
  built.apply(kit.scene)
  kit.scene.add(built.root)
  kit.setShadowExtent(18)

  const car = buildStarter(name === 'garden' ? 'buggy' : 'racer', ctx)
  const compiled = compileVehicle(car, catalog)
  if (compiled.ok) {
    const model = buildDrivingCarModel(car, compiled.spec, catalog)
    model.root.position.set(name === 'kitchen' ? 0 : 0, -compiled.spec.wheelBottomY, name === 'kitchen' ? 11 : 10)
    kit.scene.add(model.root)
  }
  if (params.get('wide') === '1')
    frame(new THREE.Vector3(-22, 0, -4), new THREE.Vector3(22, 6, 38))
  else if (name === 'garden')
    frame(new THREE.Vector3(-5, 0, 2), new THREE.Vector3(5, 1, 16))
  else
    frame(new THREE.Vector3(-4, 0, 8), new THREE.Vector3(4, 1.5, 24))
  setAngles({ yaw: name === 'kitchen' ? 2.9 : 2.75, pitch: 0.34 })
  return true
}

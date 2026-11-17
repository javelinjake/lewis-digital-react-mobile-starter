import type { EnvMaterialKey } from './env-textures'
/**
 * Environment renderer: static boxes merged by material (procedural textures at world scale), props
 * merged by colour, sky/fog, and optional challenge gates and markers.
 */
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { DecoProp, EnvironmentDefinition, StaticBox } from '@/game/env/types'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildChallengeOverlay } from './env-gates'
import { envMaterial, propMaterial, skyTexture, worldSizeFor } from './env-textures'

export interface EnvironmentMesh {
  root: THREE.Group
  /** Sets the sky backdrop and fog on the scene. */
  apply: (scene: THREE.Scene) => void
  dispose: () => void
}

const DEFAULT_LOOK: Record<StaticBox['surface'], EnvMaterialKey> = {
  tile: 'tile',
  plastic: 'plastic',
  grass: 'grass',
  mud: 'mud',
  wood: 'wood',
}

/** BoxGeometry with UVs in world metres divided by the texture's world size. */
function boxWithWorldUv(box: StaticBox, worldSize: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(box.half[0] * 2, box.half[1] * 2, box.half[2] * 2)
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + box.half[0]
    const y = pos.getY(i) + box.half[1]
    const z = pos.getZ(i) + box.half[2]
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    if (ax > 0.5)
      uv.setXY(i, z / worldSize, y / worldSize)
    else if (ay > 0.5)
      uv.setXY(i, x / worldSize, z / worldSize)
    else
      uv.setXY(i, x / worldSize, y / worldSize)
  }
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...box.centre),
    box.rot ? new THREE.Quaternion(box.rot[0], box.rot[1], box.rot[2], box.rot[3]) : new THREE.Quaternion(),
    new THREE.Vector3(1, 1, 1),
  )
  g.applyMatrix4(m)
  return g
}

function propGeometry(p: DecoProp): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  switch (p.shape) {
    case 'cylinder':
      g = new THREE.CylinderGeometry(0.5, 0.5, 1, 20)
      break
    case 'sphere':
      g = new THREE.SphereGeometry(0.5, 18, 14)
      break
    case 'cone':
      g = new THREE.ConeGeometry(0.5, 1, 20)
      break
    default:
      g = new THREE.BoxGeometry(1, 1, 1)
  }
  g.deleteAttribute('uv')
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...p.centre),
    p.rot ? new THREE.Quaternion(p.rot[0], p.rot[1], p.rot[2], p.rot[3]) : new THREE.Quaternion(),
    new THREE.Vector3(...p.size),
  ))
  return g
}

const BIG = 0.9

export function buildEnvironment(env: EnvironmentDefinition, challenge?: ChallengeDefinition): EnvironmentMesh {
  const root = new THREE.Group()
  root.name = `env-${env.id}`
  const owned: THREE.BufferGeometry[] = []

  const groups = new Map<string, { key: EnvMaterialKey, colour: string, geos: THREE.BufferGeometry[], cast: boolean }>()
  for (const box of env.boxes) {
    if (box.look?.hidden)
      continue
    const key = box.look?.material ?? DEFAULT_LOOK[box.surface]
    const colour = box.look?.colour ?? '#ffffff'
    const id = `${key}|${colour}`
    const entry = groups.get(id) ?? { key, colour, geos: [], cast: false }
    groups.set(id, entry)
    entry.geos.push(boxWithWorldUv(box, worldSizeFor(key)))
    if (box.kind !== 'ground' && Math.max(...box.half) * 2 > BIG)
      entry.cast = true
  }
  for (const entry of groups.values()) {
    const merged = mergeGeometries(entry.geos)
    entry.geos.forEach(g => g.dispose())
    owned.push(merged)
    const mesh = new THREE.Mesh(merged, envMaterial(entry.key, entry.colour))
    mesh.receiveShadow = true
    mesh.castShadow = entry.cast
    root.add(mesh)
  }

  const propGroups = new Map<string, { geos: THREE.BufferGeometry[], cast: boolean }>()
  for (const p of env.props) {
    const entry = propGroups.get(p.colour) ?? { geos: [], cast: false }
    propGroups.set(p.colour, entry)
    entry.geos.push(propGeometry(p))
    if (Math.max(...p.size) > BIG)
      entry.cast = true
  }
  for (const [colour, entry] of propGroups) {
    const merged = mergeGeometries(entry.geos)
    entry.geos.forEach(g => g.dispose())
    owned.push(merged)
    const mesh = new THREE.Mesh(merged, propMaterial(colour))
    mesh.castShadow = entry.cast
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const overlay = challenge ? buildChallengeOverlay(challenge) : null
  if (overlay)
    root.add(overlay.root)

  let sky: THREE.Texture | null = null
  let appliedTo: THREE.Scene | null = null

  return {
    root,
    apply(scene) {
      appliedTo = scene
      sky = skyTexture(env.sky.top, env.sky.bottom)
      scene.background = sky ?? new THREE.Color(env.sky.bottom)
      scene.fog = new THREE.Fog(env.fogColour, env.fogFar * 0.4, env.fogFar)
    },
    dispose() {
      overlay?.dispose()
      owned.forEach(g => g.dispose())
      if (appliedTo) {
        if (appliedTo.background === sky || appliedTo.background instanceof THREE.Color)
          appliedTo.background = null
        appliedTo.fog = null
      }
      root.clear()
    },
  }
}

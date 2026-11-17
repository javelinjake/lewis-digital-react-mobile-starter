import type { CarDocument } from '@/game/build/types'
import type { PartCatalog } from '@/game/catalog/catalog'
import type { VehicleSpec } from '@/game/vehicle/compile'
import * as THREE from 'three'
import { computeAssemblies, mainAssemblyIds } from '@/game/build/assemblies'
import { colourHex } from '@/game/catalog/palette'
import { bodyMapper } from '@/game/vehicle/compile'
import { disposeObject } from './dispose'
import { materialForSlot } from './materials'
import { GeometryAccumulator, getLocalGeo, getWheelNodeGeometry } from './part-geometry'

export interface WheelPose {
  /** Radians, positive = right. */
  steer: number
  /** Radians about the axle, positive when rolling forward. */
  spin: number
  /** Metres along body up. */
  offset: number
}

export interface CarModel {
  /** Physics body frame: origin at the centre of mass, +Z forward, +Y up. */
  root: THREE.Group
  /** Aligned with `spec.wheels`. */
  wheelNodes: THREE.Object3D[]
  update: (wheels: ReadonlyArray<WheelPose>) => void
  setBrakeLights: (on: boolean) => void
  dispose: () => void
}

interface WheelRig {
  node: THREE.Group
  spin: THREE.Group
  axis: THREE.Vector3
  base: readonly [number, number, number]
}

/** The compiled car in its physics body frame, with independently animated wheels. */
export function buildDrivingCarModel(doc: CarDocument, spec: VehicleSpec, catalog: PartCatalog): CarModel {
  const root = new THREE.Group()
  root.name = 'driving-car'
  const map = bodyMapper(doc.forward)
  const com = spec.centreOfMassLattice
  const frame = {
    point: (p: readonly [number, number, number]) => {
      const b = map.point([p[0], p[1], p[2]])
      return [b[0] - com[0], b[1] - com[1], b[2] - com[2]] as [number, number, number]
    },
    dir: (n: readonly [number, number, number]) => map.dir(n) as [number, number, number],
  }

  const main = mainAssemblyIds(computeAssemblies(doc, catalog))
  const connected = new Map<string, Set<string>>()
  for (const c of doc.connections) {
    for (const end of [c.a, c.b]) {
      const set = connected.get(end.instanceId) ?? new Set<string>()
      set.add(end.connectorId)
      connected.set(end.instanceId, set)
    }
  }

  const buckets = new Map<string, { slot: 'primary' | 'tyre' | 'glass', hex: string, acc: GeometryAccumulator }>()
  const bucket = (slot: 'primary' | 'tyre' | 'glass', hex: string) => {
    const key = slot === 'primary' ? `${slot}:${hex}` : slot
    let b = buckets.get(key)
    if (!b) {
      b = { slot, hex, acc: new GeometryAccumulator() }
      buckets.set(key, b)
    }
    return b.acc
  }

  for (const inst of doc.instances) {
    if (!main.has(inst.id))
      continue
    const def = catalog.get(inst.defId)
    if (!def || def.wheel)
      continue
    const hex = colourHex(inst.colour)
    const local = getLocalGeo(def)
    const t = { size: def.size, rot: inst.rot, pos: inst.pos, frame }
    for (const [slot, geo] of local.slots) bucket(slot, hex).add(geo, t)
    const hidden = connected.get(inst.id)
    const primary = bucket('primary', hex)
    for (const stud of local.studs) {
      if (!hidden?.has(stud.id))
        primary.add(stud.geo, t)
    }
  }
  for (const { slot, hex, acc } of buckets.values()) {
    if (acc.isEmpty())
      continue
    const mesh = new THREE.Mesh(acc.toGeometry(), materialForSlot(slot, hex))
    mesh.castShadow = slot !== 'glass'
    mesh.receiveShadow = slot !== 'glass'
    if (slot === 'glass')
      mesh.renderOrder = 2
    root.add(mesh)
  }

  const rigs: WheelRig[] = []
  for (const w of spec.wheels) {
    const inst = doc.instances.find(i => i.id === w.instanceId)
    const def = inst ? catalog.get(inst.defId) : undefined
    const node = new THREE.Group()
    const spin = new THREE.Group()
    const orient = new THREE.Group()
    node.add(spin)
    spin.add(orient)
    if (def?.wheel && inst) {
      for (const [slot, geo] of getWheelNodeGeometry(def)) {
        const mesh = new THREE.Mesh(geo, materialForSlot(slot, colourHex(inst.colour)))
        mesh.userData.sharedGeometry = true
        mesh.castShadow = true
        orient.add(mesh)
      }
    }
    const alongX = w.axle[0] > 0.5
    const outward = Math.sign((alongX ? w.pos[0] : w.pos[2]) || 1)
    orient.rotation.y = alongX ? (outward > 0 ? 0 : Math.PI) : -outward * (Math.PI / 2)
    node.position.set(w.pos[0], w.pos[1], w.pos[2])
    root.add(node)
    rigs.push({ node, spin, axis: new THREE.Vector3(w.axle[0], w.axle[1], w.axle[2]), base: w.pos })
  }

  // Rear brake lights: small emissive plates on the back of the body.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x7A0A0A, emissive: 0xFF1E1E, emissiveIntensity: 0.3, roughness: 0.4 })
  const lights = new THREE.Group()
  const lightGeo = new THREE.BoxGeometry(0.06, 0.022, 0.006)
  const rearZ = spec.bounds.min[2] - 0.002
  const lightY = spec.bodyMinY + (spec.bounds.max[1] - spec.bodyMinY) * 0.32
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(lightGeo, lightMat)
    m.position.set(sx * Math.max(0.05, spec.size[0] * 0.28), lightY, rearZ)
    lights.add(m)
  }
  root.add(lights)

  const model: CarModel = {
    root,
    wheelNodes: rigs.map(r => r.node),
    update(wheels) {
      rigs.forEach((rig, i) => {
        const pose = wheels[i]
        if (!pose)
          return
        rig.node.position.set(rig.base[0], rig.base[1] + pose.offset, rig.base[2])
        rig.node.rotation.y = -pose.steer
        rig.spin.quaternion.setFromAxisAngle(rig.axis, pose.spin)
      })
    },
    setBrakeLights(on) {
      lightMat.emissiveIntensity = on ? 3 : 0.3
    },
    dispose() {
      disposeObject(root)
      lightGeo.dispose()
      lightMat.dispose()
      root.clear()
    },
  }
  model.update(rigs.map(() => ({ steer: 0, spin: 0, offset: 0 })))
  return model
}

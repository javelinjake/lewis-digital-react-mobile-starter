/**
 * Dev-only harness for eyeballing the render kit: /dev/render-preview.html?scene=racer|buggy|drive|all|snap
 * Not imported by the app.
 */
import type { CarDocument } from '@/game/build/types'
import * as THREE from 'three'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { compileVehicle } from '@/game/vehicle/compile'
import { buildBuilderModel, buildDrivingCarModel, createFloorMat, createGhost, createMirrorPlane, createSceneKit, createSnapMarkers } from '@/render'
import { installEnvScenes } from './render-preview-env'

const params = new URLSearchParams(location.search)
const sceneName = params.get('scene') ?? 'racer'
const canvas = document.getElementById('c') as HTMLCanvasElement
const kit = createSceneKit(canvas, { quality: 'high', shadows: true })
kit.scene.background = new THREE.Color(0xBFD9EE)
kit.setShadowExtent(1.4)

const ctx = sequentialContext('p')
function ok(r: ReturnType<typeof addParts>): CarDocument {
  if (!r.ok)
    throw new Error(r.issues.map(i => i.message).join(';'))
  return r.doc
}

function showcaseDoc(): CarDocument {
  let doc = createEmptyDoc(ctx)
  const colours = ['orange', 'blue', 'red', 'green', 'yellow', 'teal', 'purple', 'pink', 'white']
  let x = 0
  let z = 0
  let rowDepth = 0
  const parts = catalog.list().filter(d => !d.wheel)
  parts.forEach((def, i) => {
    if (x > 34) {
      x = 0
      z += rowDepth + 3
      rowDepth = 0
    }
    doc = ok(addParts(doc, [{ defId: def.id, pos: [x, 0, z], rot: 0, colour: colours[i % colours.length]! }], ctx))
    x += def.size[0] + 2
    rowDepth = Math.max(rowDepth, def.size[2])
  })
  z += rowDepth + 3
  let wx = 0
  for (const id of ['wheel_small', 'wheel_road', 'wheel_wide', 'wheel_offroad']) {
    doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [wx, 0, z], rot: 0, colour: 'black' }], ctx))
    const spots = findPlacements(doc, catalog.get(id)!, { rotations: [0, 1, 2, 3] }, ctx).filter(k => k.pos[0] >= wx - 4 && k.pos[0] <= wx + 12 && k.pos[2] > z - 6)
    doc = ok(addParts(doc, spots.map(k => ({ defId: id, pos: k.pos, rot: k.rot, colour: 'yellow' })), ctx))
    wx += 18
  }
  return doc
}

let tick: (t: number) => void = () => {}
let frameTarget = new THREE.Vector3()
let frameDist = 1.4
let yaw = -0.85
let pitch = 0.42

function frameBox(min: THREE.Vector3, max: THREE.Vector3) {
  const c = min.clone().add(max).multiplyScalar(0.5)
  const r = max.clone().sub(min).length() / 2
  frameTarget = c
  frameDist = (r / Math.sin((kit.camera.fov * Math.PI) / 360)) * 1.05
}

function modelBounds(root: THREE.Object3D): [THREE.Vector3, THREE.Vector3] {
  const b = new THREE.Box3().setFromObject(root)
  return [b.min, b.max]
}

if (sceneName === 'drive') {
  const doc = buildStarter(params.get('car') === 'buggy' ? 'buggy' : 'racer', ctx)
  const compiled = compileVehicle(doc, catalog)
  if (!compiled.ok)
    throw new Error('compile failed')
  const model = buildDrivingCarModel(doc, compiled.spec, catalog)
  const floor = createFloorMat(2, 2)
  floor.position.y = compiled.spec.wheelBottomY
  kit.scene.add(floor, model.root)
  frameBox(new THREE.Vector3(-0.4, -0.2, -0.5), new THREE.Vector3(0.4, 0.3, 0.5))
  model.root.position.y = 0
  tick = (t) => {
    const steer = Math.sin(t * 0.8) * 0.4
    model.update(compiled.spec.wheels.map(w => ({ steer: w.steering ? steer : 0, spin: t * 6, offset: Math.sin(t * 2 + w.pos[0] * 9) * 0.004 })))
    model.setBrakeLights(Math.sin(t) > 0)
  }
}
else if (sceneName === 'all') {
  const doc = showcaseDoc()
  const model = buildBuilderModel(doc, catalog)
  const [min, max] = modelBounds(model.root)
  const mat = createFloorMat(max.x - min.x + 0.4, max.z - min.z + 0.4)
  mat.position.set((min.x + max.x) / 2, -0.0002, (min.z + max.z) / 2)
  kit.scene.add(mat, model.root)
  frameBox(min, max)
  kit.setShadowExtent(3)
  yaw = -0.35
  pitch = 0.95
  ;(window as unknown as { __stats: unknown }).__stats = model.stats
}
else if (sceneName === 'parts') {
  const ids = (params.get('ids') ?? 'slope_short').split(',')
  let doc = createEmptyDoc(ctx)
  const colours = ['orange', 'blue', 'red', 'green', 'yellow', 'teal', 'purple', 'pink', 'white']
  for (const [row, rot] of ([[0, 0], [1, 2]] as const)) {
    let x = 0
    ids.forEach((id, i) => {
      const def = catalog.get(id)!
      const w = rot === 0 ? def.size[0] : def.size[0]
      doc = ok(addParts(doc, [{ defId: id, pos: [x, 0, row * 16], rot, colour: colours[i % colours.length]! }], ctx))
      x += w + 2
    })
  }
  const model = buildBuilderModel(doc, catalog)
  const [min, max] = modelBounds(model.root)
  const mat = createFloorMat(max.x - min.x + 0.3, max.z - min.z + 0.3)
  mat.position.set((min.x + max.x) / 2, -0.0002, (min.z + max.z) / 2)
  kit.scene.add(mat, model.root)
  frameBox(min, max)
  kit.setShadowExtent(2)
  yaw = -0.6
  pitch = 0.5
}
else if (sceneName === 'snap') {
  const doc = buildStarter('racer', ctx)
  const model = buildBuilderModel(doc, catalog)
  const [min, max] = modelBounds(model.root)
  const floor = createFloorMat(2.4, 2.4)
  floor.position.set((min.x + max.x) / 2, -0.06, (min.z + max.z) / 2)
  const markers = createSnapMarkers()
  const def = catalog.get('brick_2x2')!
  const found = findPlacements(doc, def, { rotations: [0] }, ctx)
  const anchors = [...new Map(found.map(f => [f.anchor.join(','), f.anchor] as const)).values()]
  markers.set(anchors, 3)
  const best = found.filter(f => f.pos[1] === 6).sort((a, b) => b.pos[2] - a.pos[2])[0] ?? found[0]!
  const ghost = createGhost(def, best.pos, best.rot, 'valid')
  const bad = createGhost(def, [1, 5, 5], 0, 'invalid')
  const mirror = createMirrorPlane(6, { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] })
  model.setSelection(new Set([doc.instances.find(i => i.defId === 'spoiler')!.id]))
  model.setIssues(new Set([doc.instances.find(i => i.defId === 'cockpit')!.id]))
  kit.scene.add(floor, model.root, markers.root, ghost, bad, mirror)
  frameBox(min, max)
  tick = (t) => {
    markers.tick(t)
    model.tick(t)
  }
}
else if (!installEnvScenes(sceneName, kit, (min, max) => frameBox(min, max), (p) => {
  yaw = p.yaw
  pitch = p.pitch
}, ctx, params)) {
  const doc = buildStarter(sceneName === 'buggy' ? 'buggy' : 'racer', ctx)
  const model = buildBuilderModel(doc, catalog)
  const [min, max] = modelBounds(model.root)
  const floor = createFloorMat(2.4, 2.4)
  floor.position.set((min.x + max.x) / 2, -0.06, (min.z + max.z) / 2)
  kit.scene.add(floor, model.root)
  frameBox(min, max)
  ;(window as unknown as { __stats: unknown }).__stats = model.stats
}

const camYaw = params.get('yaw')
const camPitch = params.get('pitch')
if (camYaw)
  yaw = Number(camYaw)
if (camPitch)
  pitch = Number(camPitch)
const zoom = Number(params.get('zoom') ?? '1')

const start = performance.now()
let frames = 0
function loop() {
  const t = (performance.now() - start) / 1000
  tick(params.has('freeze') ? 1.3 : t)
  const d = frameDist * zoom
  kit.camera.position.set(
    frameTarget.x + Math.sin(yaw) * Math.cos(pitch) * d,
    frameTarget.y + Math.sin(pitch) * d,
    frameTarget.z + Math.cos(yaw) * Math.cos(pitch) * d,
  )
  kit.camera.lookAt(frameTarget)
  kit.followSun([frameTarget.x, frameTarget.y, frameTarget.z])
  kit.render()
  frames += 1
  if (frames === 4)
    document.title = 'ready'
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

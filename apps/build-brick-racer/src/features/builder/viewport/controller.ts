import type { ContactPreview } from '@/features/builder/logic/contact-preview'
import type { Bounds, OrbitState, ViewPreset } from '@/features/builder/logic/orbit'
import type { ProjectedAnchor } from '@/features/builder/logic/picking'
/**
 * The builder's 3D viewport, driven imperatively (no React per frame): scene kit, car model, snap rings,
 * ghost, overlays, camera and pointer gestures. React talks to it through the setters and callbacks.
 *
 * Gestures: one finger/mouse on empty space orbits; two fingers pinch-zoom and pan; the wheel zooms; a tap on
 * a part selects it. With a tray part chosen, pressing within ~28 css px of a snap ring shows the ghost,
 * sliding retargets, and releasing commits (a plain tap is press + release). Rings stacked under one spot
 * arm the ghost instead, so the player can cycle with the arrow buttons and confirm.
 */
import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument, Forward } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import type { Aabb, BuilderModel, SceneKit, SnapMarkers } from '@/render'
import * as THREE from 'three'
import { cameraPosition, EMPTY_BOUNDS, framePreset, lerpOrbit, orbitBy, panBy, zoomBy } from '@/features/builder/logic/orbit'
import { nearestAnchor, PICK_RADIUS, stackedWith, stepCycle } from '@/features/builder/logic/picking'
import { groupByAnchor } from '@/game/build/candidates'
import { catalog } from '@/game/catalog/catalog'
import { buildBuilderModel, createFloorMat, createMirrorPlane, createSceneKit, createSnapMarkers, disposeObject } from '@/render'
import { buildGhostGroup, planGhost } from './ghosts'
import { createContactOverlay, createForwardArrow, createHighlight } from './scene-overlays'

export interface ViewportCallbacks {
  /** Tap on a part (id) or on empty space (null). `additive` for shift/ctrl/cmd. */
  onTapPart: (id: string | null, additive: boolean) => void
  /** A placement was released over a ring (or confirmed after cycling). */
  onCommit: (candidate: PlacementCandidate) => void
  /** Camera gesture finished; a good moment to remember the pose. */
  onCameraSettled: (pose: OrbitState) => void
  /** Cycling state when the ghost is armed over stacked rings, else null. */
  onArmed: (state: { index: number, count: number } | null) => void
  onContextLost: () => void
}

interface PlacementState {
  def: PartDefinition
  rotation: Rot
  candidates: PlacementCandidate[]
  mirrorPlane2: number | null
}

interface AnchorEntry {
  anchor: readonly [number, number, number]
  kind: 'stud' | 'socket' | 'axle'
  cands: PlacementCandidate[]
}

interface ArmedEntry {
  anchorIndex: number
  cand: PlacementCandidate
}

const S = 0.05
const P = 0.02

function idle(fn: () => void): (() => void) {
  if (typeof requestIdleCallback === 'function') {
    const h = requestIdleCallback(fn, { timeout: 120 })
    return () => cancelIdleCallback(h)
  }
  const h = setTimeout(fn, 0)
  return () => clearTimeout(h)
}

export class BuilderViewport {
  private readonly kit: SceneKit
  private readonly floor: THREE.Object3D
  private readonly markers: SnapMarkers
  private readonly ghostRoot = new THREE.Group()
  private readonly highlight = createHighlight(0xFFD21F)
  private readonly forwardArrow = createForwardArrow()
  private readonly contact = createContactOverlay()
  private mirrorPlane: THREE.Object3D | null = null
  private model: BuilderModel | null = null
  private doc: CarDocument | null = null
  private loose: ReadonlySet<string> = new Set()
  private selection: ReadonlySet<string> = new Set()
  private issues: ReadonlySet<string> = new Set()
  private highlighted: ReadonlySet<string> = new Set()
  private bounds: Bounds = EMPTY_BOUNDS
  private groundY = 0

  private orbit: OrbitState
  private tween: { from: OrbitState, to: OrbitState, start: number, duration: number } | null = null
  private framed = false
  private initialPose: OrbitState | null = null

  private placement: PlacementState | null = null
  private anchors: AnchorEntry[] = []
  private projected: ProjectedAnchor[] = []
  private projDirty = true
  private targetIndex: number | null = null
  private armed: { list: ArmedEntry[], index: number } | null = null
  private ghostKey = ''

  private readonly pointers = new Map<number, { x: number, y: number }>()
  private mode: 'idle' | 'place' | 'orbit' | 'pinch' = 'idle'
  private start = { x: 0, y: 0, t: 0 }
  private moved = false
  private confirmArmed = false
  private pinch: { dist: number, mid: { x: number, y: number }, orbit: OrbitState } | null = null

  private raf = 0
  private cancelRebuild: (() => void) | null = null
  private settleTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private readonly raycaster = new THREE.Raycaster()
  private readonly listeners: Array<() => void> = []
  private readonly observer: ResizeObserver | null

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cb: ViewportCallbacks, private reducedMotion: boolean) {
    this.kit = createSceneKit(canvas, { quality: 'high', shadows: false })
    this.kit.scene.background = new THREE.Color(0x14325F)
    this.floor = createFloorMat(4, 4)
    this.markers = createSnapMarkers()
    this.markers.root.visible = false
    this.kit.scene.add(this.floor, this.markers.root, this.ghostRoot, this.highlight.root, this.forwardArrow.root, this.contact.root)
    this.orbit = framePreset('threeQuarter', EMPTY_BOUNDS, 'z+', this.kit.camera.fov, this.kit.camera.aspect)
    this.applyOrbit()

    const el = canvas
    const add = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts)
      this.listeners.push(() => el.removeEventListener(type, fn as EventListener, opts))
    }
    add('pointerdown', this.onDown)
    add('pointermove', this.onMove)
    add('pointerup', this.onUp)
    add('pointercancel', this.onCancel)
    add('wheel', this.onWheel, { passive: false })
    add('contextmenu', e => e.preventDefault())
    add('webglcontextlost' as keyof HTMLElementEventMap, ((e: Event) => {
      e.preventDefault()
      this.cb.onContextLost()
    }) as never)
    this.observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          this.projDirty = true
          this.invalidate()
        })
    this.observer?.observe(canvas)
  }

  // ---- Public API ------------------------------------------------------------------------------------

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value
    this.invalidate()
  }

  /** Pose to restore on first framing (from the saved car). */
  setInitialPose(pose: OrbitState | null): void {
    this.initialPose = pose
  }

  setDocument(doc: CarDocument, loose: ReadonlySet<string>): void {
    const first = this.doc === null
    this.doc = doc
    this.loose = loose
    this.cancelRebuild?.()
    if (first)
      this.rebuild()
    else
      this.cancelRebuild = idle(() => this.rebuild())
  }

  setSelection(ids: ReadonlySet<string>): void {
    this.selection = ids
    this.model?.setSelection(ids)
    this.invalidate()
  }

  setIssues(ids: ReadonlySet<string>): void {
    this.issues = ids
    this.model?.setIssues(ids)
    this.invalidate()
  }

  /** Pieces an action will change (for example both wheels of a pair), outlined in yellow. */
  setHighlight(ids: ReadonlySet<string>): void {
    this.highlighted = ids
    this.applyHighlight()
    this.invalidate()
  }

  setPlacement(p: PlacementState | null): void {
    this.placement = p
    this.clearGhost()
    this.armed = null
    this.targetIndex = null
    this.cb.onArmed(null)
    const groups = p ? [...groupByAnchor(p.candidates).values()] : []
    this.anchors = groups.map(cands => ({ anchor: cands[0]!.anchor, kind: cands[0]!.anchorKind, cands }))
    this.markers.set(this.anchors.map(a => a.anchor), undefined, this.anchors.map(a => a.kind))
    this.markers.root.visible = this.anchors.length > 0
    this.projDirty = true
    this.syncMirrorPlane()
    this.invalidate()
  }

  setMirrorPlane(plane2: number | null): void {
    if (this.placement)
      this.placement = { ...this.placement, mirrorPlane2: plane2 }
    this.syncMirrorPlane(plane2)
    this.invalidate()
  }

  setOverlays(opts: { forward: Forward | null, contacts: ContactPreview | null }): void {
    this.forwardArrow.set(opts.forward, this.bounds, this.groundY)
    this.contact.set(opts.contacts)
    this.invalidate()
  }

  getYaw(): number {
    return this.orbit.yaw
  }

  viewPreset(kind: ViewPreset): void {
    this.flyTo(framePreset(kind, this.bounds, this.doc?.forward ?? 'z+', this.kit.camera.fov, this.kit.camera.aspect))
  }

  /** Step through candidates stacked under the armed spot. */
  cycle(direction: 1 | -1): void {
    if (!this.armed)
      return
    this.armed.index = stepCycle(this.armed.list.length, this.armed.index, direction)
    this.showArmed()
  }

  commitArmed(): void {
    const a = this.armed
    if (!a)
      return
    const cand = a.list[a.index]!.cand
    this.clearArmed()
    this.cb.onCommit(cand)
  }

  cancelArmed(): void {
    this.clearArmed()
  }

  /** Screen positions of the rings in client coordinates (for automated tests). */
  ringScreenPositions(): Array<{ x: number, y: number, key: string, kind: string }> {
    this.ensureProjection()
    const rect = this.canvas.getBoundingClientRect()
    return this.projected.map(p => ({ x: rect.left + p.x, y: rect.top + p.y, key: this.anchors[p.index]!.cands[0]!.key, kind: this.anchors[p.index]!.kind }))
  }

  ringCount(): number {
    return this.anchors.length
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.cancelRebuild?.()
    if (this.settleTimer)
      clearTimeout(this.settleTimer)
    this.listeners.forEach(off => off())
    this.observer?.disconnect()
    this.clearGhost()
    this.model?.dispose()
    this.markers.dispose()
    this.highlight.dispose()
    this.forwardArrow.dispose()
    this.contact.dispose()
    if (this.mirrorPlane)
      disposeObject(this.mirrorPlane)
    disposeObject(this.floor)
    this.kit.dispose()
  }

  // ---- Model and overlays ----------------------------------------------------------------------------

  private rebuild(): void {
    this.cancelRebuild = null
    if (this.disposed || !this.doc)
      return
    const doc = this.doc
    if (this.model) {
      this.kit.scene.remove(this.model.root)
      this.model.dispose()
      this.model = null
    }
    try {
      this.model = buildBuilderModel(doc, catalog, { loose: this.loose })
      this.kit.scene.add(this.model.root)
    }
    catch {
      this.model = null
    }
    this.model?.setSelection(this.selection)
    this.model?.setLoose(this.loose)
    this.model?.setIssues(this.issues)
    this.computeBounds()
    this.floor.position.set((this.bounds.min[0] + this.bounds.max[0]) / 2, this.groundY - 0.0005, (this.bounds.min[2] + this.bounds.max[2]) / 2)
    this.applyHighlight()
    this.syncMirrorPlane()
    if (!this.framed) {
      this.framed = true
      this.orbit = this.initialPose ?? framePreset('threeQuarter', this.bounds, doc.forward, this.kit.camera.fov, this.kit.camera.aspect)
      this.applyOrbit()
    }
    this.projDirty = true
    this.invalidate()
  }

  private computeBounds(): void {
    const model = this.model
    if (!model || model.bounds.size === 0) {
      this.bounds = EMPTY_BOUNDS
      this.groundY = 0
      return
    }
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    let ground = Infinity
    for (const [id, b] of model.bounds) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, b.min[i]!)
        max[i] = Math.max(max[i]!, b.max[i]!)
      }
      const inst = this.doc?.instances.find(x => x.id === id)
      const wheel = inst ? catalog.get(inst.defId)?.wheel : undefined
      ground = Math.min(ground, wheel ? (b.min[1] + b.max[1]) / 2 - wheel.radiusM : b.min[1])
    }
    this.bounds = { min, max }
    this.groundY = ground
  }

  private applyHighlight(): void {
    const boxes: Aabb[] = []
    for (const id of this.highlighted) {
      const b = this.model?.bounds.get(id)
      if (b)
        boxes.push(b)
    }
    this.highlight.set(boxes)
  }

  private syncMirrorPlane(plane2 = this.placement?.mirrorPlane2 ?? null): void {
    if (this.mirrorPlane) {
      this.kit.scene.remove(this.mirrorPlane)
      disposeObject(this.mirrorPlane)
      this.mirrorPlane = null
    }
    if (plane2 !== null && this.placement) {
      this.mirrorPlane = createMirrorPlane(plane2, { min: this.bounds.min, max: this.bounds.max })
      this.kit.scene.add(this.mirrorPlane)
    }
  }

  // ---- Camera ----------------------------------------------------------------------------------------

  private applyOrbit(): void {
    const p = cameraPosition(this.orbit)
    this.kit.camera.position.set(p[0], p[1], p[2])
    this.kit.camera.lookAt(this.orbit.target[0], this.orbit.target[1], this.orbit.target[2])
    this.kit.camera.updateMatrixWorld()
    this.projDirty = true
    this.invalidate()
  }

  private flyTo(to: OrbitState): void {
    if (this.reducedMotion) {
      this.orbit = to
      this.applyOrbit()
      this.settle()
      return
    }
    this.tween = { from: this.orbit, to, start: performance.now(), duration: 380 }
    this.invalidate()
  }

  private settle(): void {
    if (this.settleTimer)
      clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(() => this.cb.onCameraSettled(this.orbit), 500)
  }

  // ---- Frame loop ------------------------------------------------------------------------------------

  private invalidate(): void {
    if (this.disposed || this.raf)
      return
    this.raf = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    this.raf = 0
    if (this.disposed)
      return
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration)
      const eased = t * t * (3 - 2 * t)
      this.orbit = lerpOrbit(this.tween.from, this.tween.to, eased)
      if (t >= 1) {
        this.tween = null
        this.settle()
      }
      this.applyOrbit()
    }
    const seconds = this.reducedMotion ? 0 : now / 1000
    this.model?.tick(seconds)
    this.markers.tick(seconds)
    this.kit.render()
    const animating = this.tween !== null || (!this.reducedMotion && (this.markers.root.visible || this.issues.size > 0 || this.selection.size > 0))
    if (animating)
      this.raf = requestAnimationFrame(this.frame)
  }

  // ---- Projection and placement ----------------------------------------------------------------------

  private ensureProjection(): void {
    if (!this.projDirty)
      return
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const camPos = this.kit.camera.position
    const v = new THREE.Vector3()
    this.kit.camera.updateMatrixWorld()
    this.projected = this.anchors.map((a, index) => {
      const lift = a.kind === 'stud' ? 0.0125 : 0
      v.set(a.anchor[0] * S, a.anchor[1] * P + lift, a.anchor[2] * S)
      const depth = camPos.distanceTo(v)
      v.project(this.kit.camera)
      return { index, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, depth }
    })
    this.projDirty = false
  }

  private local(e: PointerEvent): { x: number, y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private setTarget(anchorIndex: number | null): void {
    if (anchorIndex === this.targetIndex)
      return
    this.targetIndex = anchorIndex
    this.markers.set(this.anchors.map(a => a.anchor), anchorIndex ?? undefined, this.anchors.map(a => a.kind))
    if (anchorIndex === null)
      this.clearGhost()
    else
      this.showGhost(this.anchors[anchorIndex]!.cands[0]!)
  }

  private showGhost(cand: PlacementCandidate): void {
    if (!this.doc)
      return
    const key = `${cand.key}|${this.placement?.mirrorPlane2 ?? 'x'}`
    if (key === this.ghostKey)
      return
    this.clearGhost()
    this.ghostKey = key
    const group = buildGhostGroup(planGhost(this.doc, cand, this.placement?.mirrorPlane2 ?? null))
    this.ghostRoot.add(group)
    this.invalidate()
  }

  private clearGhost(): void {
    for (const child of [...this.ghostRoot.children]) {
      disposeObject(child)
      this.ghostRoot.remove(child)
    }
    this.ghostKey = ''
    this.invalidate()
  }

  private showArmed(): void {
    const a = this.armed
    if (!a)
      return
    const entry = a.list[a.index]!
    this.showGhost(entry.cand)
    this.markers.set(this.anchors.map(x => x.anchor), entry.anchorIndex, this.anchors.map(x => x.kind))
    this.cb.onArmed({ index: a.index, count: a.list.length })
  }

  private clearArmed(): void {
    this.armed = null
    this.targetIndex = null
    this.clearGhost()
    this.markers.set(this.anchors.map(a => a.anchor), undefined, this.anchors.map(a => a.kind))
    this.cb.onArmed(null)
  }

  private stackFor(anchorIndex: number): ArmedEntry[] {
    const centre = this.projected[anchorIndex]!
    return stackedWith(this.projected, centre).flatMap(p => this.anchors[p.index]!.cands.slice(0, 4).map(cand => ({ anchorIndex: p.index, cand })))
  }

  // ---- Pointer gestures ------------------------------------------------------------------------------

  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0)
      return
    try {
      this.canvas.setPointerCapture(e.pointerId)
    }
    catch {
      // Capture is best-effort.
    }
    const pt = this.local(e)
    this.pointers.set(e.pointerId, pt)
    if (this.pointers.size === 2) {
      this.beginPinch()
      return
    }
    if (this.pointers.size > 2)
      return
    this.moved = false
    this.start = { ...pt, t: performance.now() }
    this.confirmArmed = false
    if (this.placement && this.anchors.length > 0) {
      this.ensureProjection()
      const hit = nearestAnchor(this.projected, pt)
      if (hit) {
        this.mode = 'place'
        if (this.armed && this.armed.list[this.armed.index]!.anchorIndex === hit.index) {
          this.confirmArmed = true
        }
        else {
          this.armed = null
          this.cb.onArmed(null)
          this.targetIndex = null
          this.setTarget(hit.index)
        }
        return
      }
    }
    this.mode = 'orbit'
  }

  private readonly onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev)
      return
    const pt = this.local(e)
    this.pointers.set(e.pointerId, pt)
    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      this.updatePinch()
      return
    }
    if (this.mode === 'place') {
      if (this.confirmArmed)
        return
      this.ensureProjection()
      const hit = nearestAnchor(this.projected, pt, PICK_RADIUS * 1.6)
      this.setTarget(hit ? hit.index : null)
      return
    }
    if (this.mode === 'orbit') {
      if (Math.hypot(pt.x - this.start.x, pt.y - this.start.y) > 6)
        this.moved = true
      if (this.moved) {
        this.tween = null
        this.orbit = orbitBy(this.orbit, pt.x - prev.x, pt.y - prev.y)
        this.applyOrbit()
      }
    }
  }

  private readonly onUp = (e: PointerEvent): void => {
    const pt = this.local(e)
    this.pointers.delete(e.pointerId)
    if (this.mode === 'place') {
      this.mode = 'idle'
      if (this.confirmArmed) {
        this.confirmArmed = false
        this.commitArmed()
        return
      }
      const idx = this.targetIndex
      if (idx === null || !this.placement)
        return
      this.ensureProjection()
      const stack = this.stackFor(idx)
      const anchorsInStack = new Set(stack.map(s => s.anchorIndex))
      if (anchorsInStack.size > 1) {
        this.armed = { list: stack, index: Math.max(0, stack.findIndex(s => s.anchorIndex === idx)) }
        this.showArmed()
        return
      }
      const cand = this.anchors[idx]!.cands[0]!
      this.clearArmed()
      this.cb.onCommit(cand)
      return
    }
    if (this.mode === 'pinch') {
      if (this.pointers.size < 2) {
        this.pinch = null
        this.mode = this.pointers.size === 1 ? 'orbit' : 'idle'
        this.moved = true
        this.settle()
      }
      return
    }
    if (this.mode === 'orbit') {
      this.mode = 'idle'
      const tap = !this.moved && performance.now() - this.start.t < 600
      if (tap) {
        if (this.armed)
          this.clearArmed()
        this.tapAt(pt, e.shiftKey || e.ctrlKey || e.metaKey)
      }
      else {
        this.settle()
      }
    }
  }

  private readonly onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size === 0) {
      if (this.mode === 'place')
        this.setTarget(null)
      this.mode = 'idle'
      this.pinch = null
    }
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.tween = null
    this.orbit = zoomBy(this.orbit, Math.exp(-e.deltaY * 0.0015))
    this.applyOrbit()
    this.settle()
  }

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()]
    if (this.mode === 'place')
      this.setTarget(null)
    this.mode = 'pinch'
    this.tween = null
    this.pinch = { dist: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)), mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, orbit: this.orbit }
  }

  private updatePinch(): void {
    if (!this.pinch)
      return
    const [a, b] = [...this.pointers.values()]
    const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y))
    const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
    const zoomed = zoomBy(this.pinch.orbit, dist / this.pinch.dist)
    this.orbit = panBy(zoomed, mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y, this.canvas.clientHeight, this.kit.camera.fov)
    this.applyOrbit()
  }

  private tapAt(pt: { x: number, y: number }, additive: boolean): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.raycaster.setFromCamera(new THREE.Vector2((pt.x / w) * 2 - 1, -(pt.y / h) * 2 + 1), this.kit.camera)
    const id = this.model?.pick(this.raycaster.ray) ?? null
    this.cb.onTapPart(id, additive)
  }
}

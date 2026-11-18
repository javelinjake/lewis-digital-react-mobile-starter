import type { PlacementState } from './placement-layer'
/**
 * The builder's 3D viewport, driven imperatively (no React per frame): scene kit, car model, overlays,
 * camera and pointer gestures. Snap rings, ghost and cycling live in `PlacementLayer`. React talks to this
 * class through the setters and callbacks.
 *
 * Gestures: one finger/mouse on empty space orbits; two fingers pinch-zoom and pan; the wheel zooms; a tap on
 * a part selects it. With a tray part chosen, pressing within ~28 css px of a snap ring shows the ghost,
 * sliding retargets, and releasing commits (a plain tap is press + release). Rings stacked under one spot
 * arm the ghost instead, so the player can cycle with the arrow buttons and confirm.
 */
import type { ContactPreview } from '@/features/builder/logic/contact-preview'
import type { Bounds, OrbitState, ViewPreset } from '@/features/builder/logic/orbit'
import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument, Forward } from '@/game/build/types'
import type { Aabb, BuilderModel, SceneKit } from '@/render'
import * as THREE from 'three'
import { cameraPosition, EMPTY_BOUNDS, framePreset, lerpOrbit, orbitBy, panBy, zoomBy } from '@/features/builder/logic/orbit'
import { PICK_RADIUS } from '@/features/builder/logic/picking'
import { catalog } from '@/game/catalog/catalog'
import { buildBuilderModel, createFloorMat, createSceneKit, disposeObject } from '@/render'
import { findPickablePoint, idle, measureModel } from './model-bounds'
import { FramePacer } from './frame-pacer'
import { PlacementLayer } from './placement-layer'
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

export class BuilderViewport {
  private readonly kit: SceneKit
  private readonly floor: THREE.Object3D
  private readonly layer: PlacementLayer
  private readonly highlight = createHighlight(0xFFD21F)
  private readonly forwardArrow = createForwardArrow()
  private readonly contact = createContactOverlay()
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

  private readonly pointers = new Map<number, { x: number, y: number }>()
  private mode: 'idle' | 'place' | 'orbit' | 'pinch' = 'idle'
  private start = { x: 0, y: 0, t: 0 }
  private moved = false
  private confirmArmed = false
  private pinch: { dist: number, mid: { x: number, y: number }, orbit: OrbitState } | null = null
  private raf = 0
  private readonly pacer = new FramePacer()
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
    this.layer = new PlacementLayer(() => this.invalidate(), s => this.cb.onArmed(s))
    this.kit.scene.add(this.floor, this.layer.root, this.highlight.root, this.forwardArrow.root, this.contact.root)
    this.orbit = framePreset('threeQuarter', EMPTY_BOUNDS, 'z+', this.kit.camera.fov, this.kit.camera.aspect)
    this.applyOrbit()

    const add = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      canvas.addEventListener(type, fn as EventListener, opts)
      this.listeners.push(() => canvas.removeEventListener(type, fn as EventListener, opts))
    }
    add('pointerdown', this.onDown)
    add('pointermove', this.onMove)
    add('pointerup', this.onUp)
    add('pointercancel', this.onCancel)
    add('wheel', this.onWheel, { passive: false })
    add('contextmenu', e => e.preventDefault())
    const lost = (e: Event) => {
      e.preventDefault()
      this.cb.onContextLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    this.listeners.push(() => canvas.removeEventListener('webglcontextlost', lost))
    this.observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          this.layer.markDirty()
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
    this.layer.set(p, this.bounds)
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
    if (this.doc)
      this.layer.cycle(direction, this.doc)
  }

  commitArmed(): void {
    const armed = this.layer.armed
    if (!armed)
      return
    const cand = armed.list[armed.index]!.cand
    this.layer.clearArmed()
    this.cb.onCommit(cand)
  }

  cancelArmed(): void {
    this.layer.clearArmed()
  }

  /** Screen positions of the rings in client coordinates (for automated tests). */
  ringScreenPositions(): Array<{ x: number, y: number, key: string, kind: string }> {
    this.layer.ensureProjection(this.kit.camera, this.canvas.clientWidth, this.canvas.clientHeight)
    const rect = this.canvas.getBoundingClientRect()
    return this.layer.ringPositions().map(r => ({ x: rect.left + r.x, y: rect.top + r.y, key: r.key, kind: r.kind }))
  }

  ringCount(): number {
    return this.layer.ringCount()
  }

  /** Client-coordinate point where tapping picks the part (for automated tests). */
  partScreenPosition(id: string): { x: number, y: number } | null {
    const p = findPickablePoint(this.model, this.kit.camera, this.canvas.clientWidth, this.canvas.clientHeight, id)
    const rect = this.canvas.getBoundingClientRect()
    return p ? { x: rect.left + p.x, y: rect.top + p.y } : null
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.cancelRebuild?.()
    if (this.settleTimer)
      clearTimeout(this.settleTimer)
    this.listeners.forEach(off => off())
    this.observer?.disconnect()
    this.layer.dispose()
    this.model?.dispose()
    this.highlight.dispose()
    this.forwardArrow.dispose()
    this.contact.dispose()
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
    const measured = measureModel(this.model, doc)
    this.bounds = measured.bounds
    this.groundY = measured.groundY
    this.floor.position.set((this.bounds.min[0] + this.bounds.max[0]) / 2, this.groundY - 0.0005, (this.bounds.min[2] + this.bounds.max[2]) / 2)
    this.applyHighlight()
    this.layer.syncMirror(this.layer.mirrorPlane2, this.bounds)
    if (!this.framed) {
      this.framed = true
      this.orbit = this.initialPose ?? framePreset('threeQuarter', this.bounds, doc.forward, this.kit.camera.fov, this.kit.camera.aspect)
      this.applyOrbit()
    }
    this.layer.markDirty()
    this.invalidate()
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

  // ---- Camera and frame loop -------------------------------------------------------------------------

  private applyOrbit(): void {
    const p = cameraPosition(this.orbit)
    this.kit.camera.position.set(p[0], p[1], p[2])
    this.kit.camera.lookAt(this.orbit.target[0], this.orbit.target[1], this.orbit.target[2])
    this.kit.camera.updateMatrixWorld()
    this.layer.markDirty()
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

  private invalidate(): void {
    this.pacer.mark()
    if (this.disposed || this.raf)
      return
    this.raf = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number): void => {
    this.raf = 0
    if (this.disposed)
      return
    if (!this.pacer.shouldDraw(now, this.tween !== null)) {
      this.raf = requestAnimationFrame(this.frame)
      return
    }
    if (this.pacer.lagging && this.kit.quality === 'high')
      this.kit.setQuality('low')
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration)
      this.orbit = lerpOrbit(this.tween.from, this.tween.to, t * t * (3 - 2 * t))
      if (t >= 1) {
        this.tween = null
        this.settle()
      }
      this.applyOrbit()
    }
    const seconds = this.reducedMotion ? 0 : now / 1000
    this.model?.tick(seconds)
    this.layer.tick(seconds)
    this.kit.render()
    const pulsing = !this.reducedMotion && (this.layer.animating || this.issues.size > 0 || this.selection.size > 0)
    if (this.tween !== null || pulsing)
      this.raf = requestAnimationFrame(this.frame)
    else
      this.pacer.idle()
  }

  // ---- Pointer gestures ------------------------------------------------------------------------------

  private local(e: PointerEvent): { x: number, y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private project(): void {
    this.layer.ensureProjection(this.kit.camera, this.canvas.clientWidth, this.canvas.clientHeight)
  }

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
    if (this.layer.active) {
      this.project()
      const hit = this.layer.nearest(pt)
      if (hit) {
        this.mode = 'place'
        const armed = this.layer.armed
        if (armed && armed.list[armed.index]!.anchorIndex === hit.index) {
          this.confirmArmed = true
        }
        else {
          this.layer.clearArmed()
          this.layer.setTarget(hit.index, this.doc)
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
    }
    else if (this.mode === 'place') {
      if (this.confirmArmed)
        return
      this.project()
      this.layer.setTarget(this.layer.nearest(pt, PICK_RADIUS * 1.6)?.index ?? null, this.doc)
    }
    else if (this.mode === 'orbit') {
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
      this.finishPlace()
    }
    else if (this.mode === 'pinch') {
      if (this.pointers.size < 2) {
        this.pinch = null
        this.mode = this.pointers.size === 1 ? 'orbit' : 'idle'
        this.moved = true
        this.settle()
      }
    }
    else if (this.mode === 'orbit') {
      this.mode = 'idle'
      if (!this.moved && performance.now() - this.start.t < 600) {
        if (this.layer.armed)
          this.layer.clearArmed()
        this.tapAt(pt, e.shiftKey || e.ctrlKey || e.metaKey)
      }
      else {
        this.settle()
      }
    }
  }

  /** Release over a ring: commit, or arm the ghost when several rings are stacked under the finger. */
  private finishPlace(): void {
    if (this.confirmArmed) {
      this.confirmArmed = false
      this.commitArmed()
      return
    }
    const idx = this.layer.targetIndex
    if (idx === null || !this.doc)
      return
    this.project()
    if (this.layer.arm(idx, this.doc))
      return
    const cand = this.layer.bestAt(idx)
    this.layer.clearArmed()
    this.cb.onCommit(cand)
  }

  private readonly onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size === 0) {
      if (this.mode === 'place')
        this.layer.setTarget(null, this.doc)
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
      this.layer.setTarget(null, this.doc)
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
    this.cb.onTapPart(this.model?.pick(this.raycaster.ray) ?? null, additive)
  }
}

import type { Bounds } from '@/features/builder/logic/orbit'
import type { ProjectedAnchor } from '@/features/builder/logic/picking'
/**
 * Placement layer of the viewport: snap rings, the ghost preview, mirror plane, screen-space picking and the
 * "armed" state used to cycle between rings stacked under one spot.
 */
import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import * as THREE from 'three'
import { nearestAnchor, PICK_RADIUS, stackedWith, stepCycle } from '@/features/builder/logic/picking'
import { groupByAnchor } from '@/game/build/candidates'
import { createMirrorPlane, createSnapMarkers, disposeObject } from '@/render'
import { buildGhostGroup, planGhost } from './ghosts'

export interface PlacementState {
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

export interface ArmedEntry {
  anchorIndex: number
  cand: PlacementCandidate
}

const S = 0.05
const P = 0.02

export class PlacementLayer {
  readonly root = new THREE.Group()
  private readonly markers = createSnapMarkers()
  private readonly ghostRoot = new THREE.Group()
  private mirrorPlane: THREE.Object3D | null = null
  private placement: PlacementState | null = null
  private anchors: AnchorEntry[] = []
  private projected: ProjectedAnchor[] = []
  private dirty = true
  private ghostKey = ''
  targetIndex: number | null = null
  armed: { list: ArmedEntry[], index: number } | null = null

  constructor(private readonly onChange: () => void, private readonly onArmed: (s: { index: number, count: number } | null) => void) {
    this.markers.root.visible = false
    this.root.add(this.markers.root, this.ghostRoot)
  }

  get active(): boolean {
    return this.placement !== null && this.anchors.length > 0
  }

  get mirrorPlane2(): number | null {
    return this.placement?.mirrorPlane2 ?? null
  }

  tick(seconds: number): void {
    this.markers.tick(seconds)
  }

  get animating(): boolean {
    return this.markers.root.visible
  }

  markDirty(): void {
    this.dirty = true
  }

  set(p: PlacementState | null, bounds: Bounds): void {
    this.placement = p
    this.clearGhost()
    this.armed = null
    this.targetIndex = null
    this.onArmed(null)
    const groups = p ? [...groupByAnchor(p.candidates).values()] : []
    this.anchors = groups.map(cands => ({ anchor: cands[0]!.anchor, kind: cands[0]!.anchorKind, cands }))
    this.refreshMarkers()
    this.markers.root.visible = this.anchors.length > 0
    this.dirty = true
    this.syncMirror(p?.mirrorPlane2 ?? null, bounds)
    this.onChange()
  }

  setMirror(plane2: number | null, bounds: Bounds): void {
    if (this.placement)
      this.placement = { ...this.placement, mirrorPlane2: plane2 }
    this.syncMirror(plane2, bounds)
    this.onChange()
  }

  syncMirror(plane2: number | null, bounds: Bounds): void {
    if (this.mirrorPlane) {
      this.root.remove(this.mirrorPlane)
      disposeObject(this.mirrorPlane)
      this.mirrorPlane = null
    }
    if (plane2 !== null && this.placement) {
      this.mirrorPlane = createMirrorPlane(plane2, { min: bounds.min, max: bounds.max })
      this.root.add(this.mirrorPlane)
    }
  }

  private refreshMarkers(highlight?: number): void {
    this.markers.set(this.anchors.map(a => a.anchor), highlight, this.anchors.map(a => a.kind))
  }

  ensureProjection(camera: THREE.PerspectiveCamera, width: number, height: number): void {
    if (!this.dirty)
      return
    const v = new THREE.Vector3()
    camera.updateMatrixWorld()
    this.projected = this.anchors.map((a, index) => {
      v.set(a.anchor[0] * S, a.anchor[1] * P + (a.kind === 'stud' ? 0.0125 : 0), a.anchor[2] * S)
      const depth = camera.position.distanceTo(v)
      v.project(camera)
      return { index, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, depth }
    })
    this.dirty = false
  }

  nearest(pt: { x: number, y: number }, radius = PICK_RADIUS): ProjectedAnchor | null {
    return nearestAnchor(this.projected, pt, radius)
  }

  ringPositions(): Array<{ index: number, x: number, y: number, key: string, kind: string }> {
    return this.projected.map(p => ({ index: p.index, x: p.x, y: p.y, key: this.anchors[p.index]!.cands[0]!.key, kind: this.anchors[p.index]!.kind }))
  }

  ringCount(): number {
    return this.anchors.length
  }

  bestAt(index: number): PlacementCandidate {
    return this.anchors[index]!.cands[0]!
  }

  setTarget(index: number | null, doc: CarDocument | null): void {
    if (index === this.targetIndex)
      return
    this.targetIndex = index
    this.refreshMarkers(index ?? undefined)
    if (index === null)
      this.clearGhost()
    else if (doc)
      this.showGhost(this.bestAt(index), doc)
  }

  showGhost(cand: PlacementCandidate, doc: CarDocument): void {
    const key = `${cand.key}|${this.placement?.mirrorPlane2 ?? 'x'}`
    if (key === this.ghostKey)
      return
    this.clearGhost()
    this.ghostKey = key
    this.ghostRoot.add(buildGhostGroup(planGhost(doc, cand, this.placement?.mirrorPlane2 ?? null)))
    this.onChange()
  }

  clearGhost(): void {
    for (const child of [...this.ghostRoot.children]) {
      disposeObject(child)
      this.ghostRoot.remove(child)
    }
    this.ghostKey = ''
    this.onChange()
  }

  /** Rings within the stack radius of `index`, as a cycle list (nearest to the camera first). */
  arm(index: number, doc: CarDocument): boolean {
    const centre = this.projected[index]
    if (!centre)
      return false
    const list = stackedWith(this.projected, centre).flatMap(p => this.anchors[p.index]!.cands.slice(0, 4).map(cand => ({ anchorIndex: p.index, cand })))
    if (new Set(list.map(l => l.anchorIndex)).size < 2)
      return false
    this.armed = { list, index: Math.max(0, list.findIndex(l => l.anchorIndex === index)) }
    this.showArmed(doc)
    return true
  }

  cycle(direction: 1 | -1, doc: CarDocument): void {
    if (!this.armed)
      return
    this.armed.index = stepCycle(this.armed.list.length, this.armed.index, direction)
    this.showArmed(doc)
  }

  private showArmed(doc: CarDocument): void {
    const a = this.armed
    if (!a)
      return
    const entry = a.list[a.index]!
    this.showGhost(entry.cand, doc)
    this.refreshMarkers(entry.anchorIndex)
    this.onArmed({ index: a.index, count: a.list.length })
  }

  clearArmed(): void {
    this.armed = null
    this.targetIndex = null
    this.clearGhost()
    this.refreshMarkers()
    this.onArmed(null)
  }

  dispose(): void {
    this.clearGhost()
    if (this.mirrorPlane)
      disposeObject(this.mirrorPlane)
    this.markers.dispose()
  }
}

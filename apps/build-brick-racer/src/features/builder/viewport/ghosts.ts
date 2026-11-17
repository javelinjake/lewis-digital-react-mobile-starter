import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument } from '@/game/build/types'
import type { Rot, V3I } from '@/game/lattice'
import * as THREE from 'three'
import { defaultContext } from '@/game/build/doc'
import { addParts } from '@/game/build/edit'
import { mirrorPlacement } from '@/game/build/mirror'
import { catalog } from '@/game/catalog/catalog'
import { createGhost } from '@/render'

export interface GhostPart {
  defId: string
  pos: V3I
  rot: Rot
}

export interface GhostPlan {
  parts: GhostPart[]
  /** False when the whole pair (original + mirror image) cannot be placed. Nothing partial is ever committed. */
  valid: boolean
  mirrorFailed: boolean
}

/** What a placement would create, including its mirror image, and whether it would succeed. */
export function planGhost(doc: CarDocument, cand: Pick<PlacementCandidate, 'defId' | 'pos' | 'rot'>, mirrorPlane2: number | null): GhostPlan {
  const parts: GhostPart[] = [{ defId: cand.defId, pos: cand.pos, rot: cand.rot }]
  let mirrorFailed = false
  if (mirrorPlane2 !== null) {
    const m = mirrorPlacement(cand, mirrorPlane2, defaultContext)
    if (!m)
      mirrorFailed = true
    else if (!m.onPlane)
      parts.push({ defId: m.defId, pos: m.pos, rot: m.rot })
  }
  const valid = !mirrorFailed && addParts(doc, parts.map(p => ({ ...p, colour: 'orange' })), defaultContext).ok
  return { parts, valid, mirrorFailed }
}

export function buildGhostGroup(plan: GhostPlan): THREE.Group {
  const group = new THREE.Group()
  group.name = 'placement-ghost'
  for (const p of plan.parts) {
    const def = catalog.get(p.defId)
    if (def)
      group.add(createGhost(def, p.pos, p.rot, plan.valid ? 'valid' : 'invalid'))
  }
  return group
}

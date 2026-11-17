/**
 * Placement candidates for the selected tray part. Computation is async and cancellable: each request
 * gets a revision token, so a result for an older document, part or rotation never overwrites a newer one.
 * Results are memoised per document revision + part + rotation.
 */
import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import { findPlacements, rotationsFor } from '@/game/build/candidates'
import { defaultContext } from '@/game/build/doc'

export interface CandidateResult {
  candidates: PlacementCandidate[]
  /** True when a newer request replaced this one before it finished. Callers must ignore stale results. */
  stale: boolean
}

const keyOf = (doc: CarDocument, def: PartDefinition, rot: Rot) => `${doc.carId}|${doc.revisionId}|${def.id}|${rot}`

export class CandidateEngine {
  private token = 0
  private readonly cache = new Map<string, PlacementCandidate[]>()
  constructor(private readonly delay: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0))) {}

  /** Cancel any request in flight. */
  cancel(): void {
    this.token += 1
  }

  async request(doc: CarDocument, def: PartDefinition, rot: Rot): Promise<CandidateResult> {
    const mine = ++this.token
    const key = keyOf(doc, def, rot)
    const cached = this.cache.get(key)
    if (cached)
      return { candidates: cached, stale: mine !== this.token }
    // Yield so the UI can paint before a heavy search on a large car.
    await this.delay()
    if (mine !== this.token)
      return { candidates: [], stale: true }
    const candidates = findPlacements(doc, def, { rotations: rotationsFor(def, rot) }, defaultContext)
    if (mine !== this.token)
      return { candidates: [], stale: true }
    this.cache.set(key, candidates)
    if (this.cache.size > 8)
      this.cache.delete(this.cache.keys().next().value as string)
    return { candidates, stale: false }
  }
}

import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import { useEffect, useRef, useState } from 'react'
import { CandidateEngine } from '@/features/builder/logic/candidate-engine'

/** Candidates for the chosen tray part. Cleared immediately when anything they depend on changes. */
export function usePlacementCandidates(doc: CarDocument, def: PartDefinition | null, rotation: Rot): PlacementCandidate[] {
  const [candidates, setCandidates] = useState<PlacementCandidate[]>([])
  const engine = useRef(new CandidateEngine())
  const docRef = useRef(doc)
  docRef.current = doc

  useEffect(() => {
    const e = engine.current
    setCandidates([])
    if (!def) {
      e.cancel()
      return
    }
    let live = true
    void e.request(docRef.current, def, rotation).then((r) => {
      if (live && !r.stale)
        setCandidates(r.candidates)
    })
    return () => {
      live = false
    }
  }, [doc.revisionId, doc.carId, def, rotation])

  return candidates
}

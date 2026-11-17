import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { sequentialContext } from '@/game/build/doc'
import { addParts, deleteParts, duplicateParts, movePartsBy, paintParts, rotateParts, setForward, setWheelRoles, swapWheelGroup } from '@/game/build/edit'
import { mirrorPlacement, defaultMirrorPlane2 } from '@/game/build/mirror'
import { deriveConnections } from '@/game/build/connections'
import { placeAll } from '@/game/build/geometry'
import { computeAssemblies } from '@/game/build/assemblies'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { compileVehicle } from '@/game/vehicle/compile'
import { assessDrive } from '@/game/vehicle/analysis'

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32) }

describe('random edit sequences keep invariants', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      const r = rng(seed)
      const c = sequentialContext(`z${seed}_`)
      let doc: CarDocument = buildStarter(seed % 2 ? 'racer' : 'buggy', c)
      const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!
      for (let step = 0; step < 60; step++) {
        const ids = doc.instances.map(i => i.id)
        const sel = Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(ids))
        const op = Math.floor(r() * 10)
        const before = JSON.stringify(doc)
        let res
        try {
          switch (op) {
            case 0: { const def = pick([...catalog.list()]); const spots = findPlacements(doc, def, { rotations: [0, 1, 2, 3], limit: 50 }, c); if (spots.length) { const s = pick(spots); res = addParts(doc, [{ defId: def.id, pos: s.pos, rot: s.rot, colour: 'red' }], c) } break }
            case 1: res = movePartsBy(doc, sel, [Math.floor(r() * 5) - 2, 0, Math.floor(r() * 5) - 2], c); break
            case 2: res = rotateParts(doc, sel, c, r() < 0.5 ? 1 : -1); break
            case 3: res = deleteParts(doc, sel, c); break
            case 4: res = duplicateParts(doc, sel, c); break
            case 5: res = paintParts(doc, sel, 'blue', c); break
            case 6: { const g = pick(doc.wheelGroups); if (g) res = swapWheelGroup(doc, g.id, pick(['wheel_small', 'wheel_road', 'wheel_wide', 'wheel_offroad']), c); break }
            case 7: { const g = pick(doc.wheelGroups); if (g) res = setWheelRoles(doc, g.id, { steering: r() < 0.5, driven: r() < 0.5 }, c); break }
            case 8: res = setForward(doc, pick(['x+', 'x-', 'z+', 'z-'] as const), c); break
            case 9: { const p = placeAll(doc.instances, catalog).placed; const a = pick(p); const m = mirrorPlacement({ defId: a.instance.defId, pos: a.instance.pos, rot: a.instance.rot }, defaultMirrorPlane2(doc, c), c); void m; break }
          }
        }
        catch (e) { throw new Error(`threw on op ${op} step ${step}: ${(e as Error).message}`) }
        expect(JSON.stringify(doc)).toBe(before) // input never mutated
        if (!res) continue
        if (!res.ok) continue
        const next = res.doc
        // invariants
        const set = placeAll(next.instances, catalog)
        expect(next.connections).toEqual(deriveConnections(set.placed))
        const idsN = new Set(next.instances.map(i => i.id))
        expect(idsN.size).toBe(next.instances.length)
        const wheels = new Set(set.placed.filter(p => p.def.wheel).map(p => p.instance.id))
        const grouped = next.wheelGroups.flatMap(g => g.instanceIds)
        expect(new Set(grouped).size).toBe(grouped.length)
        expect(new Set(grouped)).toEqual(wheels)
        if (next.instances.length) expect(idsN.has(next.rootInstanceId!)).toBe(true)
        computeAssemblies(next, catalog)
        const a = assessDrive(next, catalog)
        for (const b of a.blocks) expect(['no_wheels', 'nothing_to_drive', 'unknown_part', 'non_finite_mass']).toContain(b.code)
        const comp = compileVehicle(next, catalog)
        if (comp.ok) {
          expect(Number.isFinite(comp.spec.mass)).toBe(true)
          expect(comp.spec.wheels.every(w => Number.isFinite(w.pos[0] + w.pos[1] + w.pos[2]))).toBe(true)
        }
        doc = next
      }
    })
  }
})

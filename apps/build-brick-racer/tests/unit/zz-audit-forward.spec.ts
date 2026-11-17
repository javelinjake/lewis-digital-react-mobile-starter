import type { CarDocument, Forward } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { rotateParts, setForward } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { compileVehicle } from '@/game/vehicle/compile'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}

// k quarter turns (rotateParts turns=1): local +Z (forward z+) -> -X after 1 turn, -Z after 2, +X after 3.
const FWD: Forward[] = ['z+', 'x-', 'z-', 'x+']

function rotated(doc: CarDocument, k: number, c: ReturnType<typeof sequentialContext>) {
  let d = doc
  for (let i = 0; i < k; i++)
    d = ok(rotateParts(d, d.instances.map(x => x.id), c, 1)).doc
  return ok(setForward(d, FWD[k]!, c)).doc
}

describe('forward directions', () => {
  for (const starter of ['racer', 'buggy'] as const) {
    for (const k of [1, 2, 3]) {
      it(`${starter} rotated ${k} quarter turns compiles identically in the body frame`, () => {
        const c = sequentialContext('f')
        const base = buildStarter(starter, c)
        const a = compileVehicle(base, catalog)
        const rot = rotated(base, k, c)
        const b = compileVehicle(rot, catalog)
        if (!a.ok || !b.ok)
          throw new Error(JSON.stringify([a, b]))
        const sa = a.spec
        const sb = b.spec
        expect(sb.mass).toBeCloseTo(sa.mass, 9)
        expect(sb.size[0]).toBeCloseTo(sa.size[0], 9)
        expect(sb.size[2]).toBeCloseTo(sa.size[2], 9)
        const key = (w: { pos: readonly number[], axle: readonly number[], steering: boolean, driven: boolean }) => `${w.pos.map(v => v.toFixed(5)).join(',')}|${w.axle.join(',')}|${w.steering}|${w.driven}`
        expect(sb.wheels.map(key).sort()).toEqual(sa.wheels.map(key).sort())
        expect(sb.aero.front).toBeCloseTo(sa.aero.front, 9)
        expect(sb.aero.side).toBeCloseTo(sa.aero.side, 9)
        expect(sb.aero.top).toBeCloseTo(sa.aero.top, 9)
        expect(sb.aero.wings.map(w => [w.area, +w.shielded.toFixed(6), +w.alignment.toFixed(6), ...w.pos.map(v => Math.round(v * 1e6) / 1e6 + 0)])).toEqual(sa.aero.wings.map(w => [w.area, +w.shielded.toFixed(6), +w.alignment.toFixed(6), ...w.pos.map(v => Math.round(v * 1e6) / 1e6 + 0)]))
        expect(sb.bodyMinY).toBeCloseTo(sa.bodyMinY, 9)
        expect(sb.wheelBottomY).toBeCloseTo(sa.wheelBottomY, 9)
        expect(sb.inertia.values.map(v => +v.toFixed(9)).sort()).toEqual(sa.inertia.values.map(v => +v.toFixed(9)).sort())
        expect(a.warnings.map(w => w.code).sort()).toEqual(b.warnings.map(w => w.code).sort())
      })
    }
  }
})

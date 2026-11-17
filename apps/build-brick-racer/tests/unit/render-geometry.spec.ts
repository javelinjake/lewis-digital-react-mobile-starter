import type * as THREE from 'three'
import type { Rot } from '@/game/lattice'
import { describe, expect, it } from 'vitest'
import { placeDefinition } from '@/game/build/geometry'
import { PART_DEFINITIONS } from '@/game/catalog/parts'
import { rotPointReal } from '@/game/lattice'
import { UNITS } from '@/game/units'
import { triangleCount } from '@/render/geo'
import { buildPartGeometry } from '@/render/part-geometry'
import { STUD_HEIGHT } from '@/render/part-shapes'

const ROTS: Rot[] = [0, 1, 2, 3]
const S = UNITS.studM
const P = UNITS.plateM

function vertices(g: THREE.BufferGeometry): number[] {
  return Array.from(g.getAttribute('position').array as Float32Array)
}

describe('part geometry', () => {
  it('can omit hidden studs', () => {
    const def = PART_DEFINITIONS.find(d => d.id === 'plate_2x4')!
    const all = triangleCount(buildPartGeometry(def, { pos: [0, 0, 0], rot: 0 }).bySlot.get('primary')!)
    const hidden = new Set(def.connectors.filter(c => c.type === 'stud').slice(0, 4).map(c => c.id))
    const fewer = triangleCount(buildPartGeometry(def, { pos: [0, 0, 0], rot: 0 }, hidden).bySlot.get('primary')!)
    expect(fewer).toBe(all - 4 * 30)
  })

  it('builds every part at every rotation with finite data inside the placed bounds', () => {
    const problems: string[] = []
    for (const def of PART_DEFINITIONS) {
      for (const rot of ROTS) {
        const pos: [number, number, number] = [3, 2, -4]
        const { bySlot } = buildPartGeometry(def, { pos, rot })
        if (!bySlot.has('primary'))
          problems.push(`${def.id} has no primary slot`)
        const placed = placeDefinition(def, pos, rot)
        const tol = 0.014
        const lo = [placed.bounds.min[0] * S - tol, placed.bounds.min[1] * P - tol, placed.bounds.min[2] * S - tol]
        const hi = [placed.bounds.max[0] * S + tol, placed.bounds.max[1] * P + tol, placed.bounds.max[2] * S + tol]
        for (const [slot, g] of bySlot) {
          const v = vertices(g)
          if (v.length === 0)
            problems.push(`${def.id}/${slot} empty`)
          for (let i = 0; i < v.length; i += 3) {
            const inside = Number.isFinite(v[i]! + v[i + 1]! + v[i + 2]!)
              && v[i]! >= lo[0]! && v[i]! <= hi[0]! && v[i + 1]! >= lo[1]! && v[i + 1]! <= hi[1]! && v[i + 2]! >= lo[2]! && v[i + 2]! <= hi[2]!
            if (!inside) {
              problems.push(`${def.id} r${rot} ${slot} vertex ${v[i]},${v[i + 1]},${v[i + 2]} outside bounds`)
              break
            }
          }
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('puts a stud on every stud connector, rotated with the lattice convention', () => {
    for (const def of PART_DEFINITIONS) {
      const studs = def.connectors.filter(c => c.type === 'stud')
      if (studs.length === 0)
        continue
      for (const rot of ROTS) {
        const pos: [number, number, number] = [1, 1, 1]
        const v = vertices(buildPartGeometry(def, { pos, rot }).bySlot.get('primary')!)
        for (const c of studs) {
          const local = rotPointReal([c.pos2[0] / 2, c.pos2[1] / 2, c.pos2[2] / 2], def.size, rot)
          const want = [(local[0] + pos[0]) * S, (local[1] + pos[1]) * P + STUD_HEIGHT, (local[2] + pos[2]) * S]
          let found = false
          for (let i = 0; i < v.length && !found; i += 3)
            found = Math.abs(v[i]! - want[0]!) < 1e-5 && Math.abs(v[i + 1]! - want[1]!) < 1e-5 && Math.abs(v[i + 2]! - want[2]!) < 1e-5
          expect(found, `${def.id} r${rot} stud ${c.id}`).toBe(true)
        }
      }
    }
  })

  it('winds every triangle to agree with its vertex normals', () => {
    for (const def of PART_DEFINITIONS) {
      const { bySlot } = buildPartGeometry(def, { pos: [0, 0, 0], rot: 1 })
      for (const [slot, g] of bySlot) {
        const p = g.getAttribute('position')
        const n = g.getAttribute('normal')
        const idx = g.getIndex()!
        let bad = 0
        const total = idx.count / 3
        for (let t = 0; t < idx.count; t += 3) {
          const a = idx.getX(t)
          const b = idx.getX(t + 1)
          const c = idx.getX(t + 2)
          const e1 = [p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a)]
          const e2 = [p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a)]
          const f = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
          const nx = n.getX(a) + n.getX(b) + n.getX(c)
          const ny = n.getY(a) + n.getY(b) + n.getY(c)
          const nz = n.getZ(a) + n.getZ(b) + n.getZ(c)
          if (f[0]! * nx + f[1]! * ny + f[2]! * nz < -1e-12)
            bad += 1
        }
        expect(bad / total, `${def.id}/${slot} bad winding`).toBeLessThan(0.005)
      }
    }
  })

  it('keeps per-part triangle counts modest', () => {
    const counts: Record<string, number> = {}
    for (const def of PART_DEFINITIONS) {
      const { bySlot } = buildPartGeometry(def, { pos: [0, 0, 0], rot: 0 })
      counts[def.id] = [...bySlot.values()].reduce((a, g) => a + triangleCount(g), 0)
    }
    expect(Math.max(...Object.values(counts))).toBeLessThan(6000)
    expect(counts.brick_2x4).toBeLessThan(700)
    expect(counts.plate_1x2).toBeLessThan(400)
  })
})

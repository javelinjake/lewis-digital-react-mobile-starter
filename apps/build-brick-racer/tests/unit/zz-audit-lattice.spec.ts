import { describe, expect, it } from 'vitest'
import { PART_DEFINITIONS } from '@/game/catalog/parts'
import { normRot, rotBox, rotDir, rotPoint2, rotatedSize } from '@/game/lattice'
import type { Rot, V3I } from '@/game/lattice'

describe('lattice rotation algebra', () => {
  it('composition of quarter turns equals rotation by the sum, for every part and connector', () => {
    for (const def of PART_DEFINITIONS) {
      for (const k1 of [0, 1, 2, 3] as Rot[]) {
        for (const k2 of [0, 1, 2, 3] as Rot[]) {
          const s1 = rotatedSize(def.size, k1)
          for (const c of def.connectors) {
            const a = rotPoint2(rotPoint2(c.pos2, def.size, k1), s1, k2)
            const b = rotPoint2(c.pos2, def.size, normRot(k1 + k2))
            expect(a, `${def.id} ${c.id} ${k1}+${k2}`).toEqual(b)
            const da = rotDir(rotDir(c.dir, k1), k2)
            const db = rotDir(c.dir, normRot(k1 + k2))
            expect(da).toEqual(db)
          }
          for (const bx of def.boxes) {
            const r1 = rotBox(bx, def.size, k1)
            const r2 = rotBox(r1, s1, k2)
            const r = rotBox(bx, def.size, normRot(k1 + k2))
            expect(r2).toEqual(r)
          }
        }
      }
    }
  })
  it('rotDir is the linear part of rotPoint2', () => {
    const size: V3I = [3, 2, 5]
    for (const k of [0, 1, 2, 3] as Rot[]) {
      const o = rotPoint2([0, 0, 0], size, k)
      const e = rotPoint2([2, 0, 0], size, k)
      const f = rotPoint2([0, 0, 2], size, k)
      expect([(e[0] - o[0]) / 2, 0, (e[2] - o[2]) / 2]).toEqual(rotDir([1, 0, 0], k))
      expect([(f[0] - o[0]) / 2, 0, (f[2] - o[2]) / 2]).toEqual(rotDir([0, 0, 1], k))
    }
  })
})

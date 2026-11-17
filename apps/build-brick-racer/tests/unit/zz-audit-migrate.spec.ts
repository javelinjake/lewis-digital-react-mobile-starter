import type { StringStore } from '@/game/persistence/repo'
import { createMemoryStorage } from '@ld/offline'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { seal } from '@/game/persistence/checksum'
import { GameRepo } from '@/game/persistence/repo'
import { assessDrive } from '@/game/vehicle/analysis'

const kv = (): StringStore => { const m = new Map<string, string>(); return { get: async k => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) } }

describe('migrated saves', () => {
  it('a v0 save of a complete car is still drivable after migration', async () => {
    const db = createMemoryStorage()
    const repo = new GameRepo(db, kv())
    const racer = buildStarter('racer', sequentialContext('m'))
    const old = {
      schemaVersion: 0,
      id: 'old1',
      name: 'Old racer',
      facing: 'z+',
      parts: racer.instances.map(i => ({ id: i.id, def: i.defId, x: i.pos[0], y: i.pos[1], z: i.pos[2], rot: i.rot, color: i.colour })),
    }
    await db.set('car:old1', seal(old))
    const loaded = await repo.loadCar('old1')
    const a = assessDrive(loaded!.doc)
    console.log(loaded!.doc.connections.length, loaded!.doc.wheelGroups.length, a.blocks.map(b => b.code), a.warnings.map(b => b.code))
    expect(a.blocks).toEqual([])
  })
})

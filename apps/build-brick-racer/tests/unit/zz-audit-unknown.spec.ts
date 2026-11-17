import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { deleteParts, duplicateParts, paintParts, rotateParts } from '@/game/build/edit'
import { buildStarter } from '@/game/catalog/starters'

describe('placeholder pieces (unknown definitions)', () => {
  const c = sequentialContext('u')
  const base = buildStarter('racer', c)
  const withGhost: CarDocument = { ...base, instances: [...base.instances, { id: 'ghost', defId: 'brick_from_the_future', defVersion: 9, pos: [10, 0, 10], rot: 0, colour: 'red' }] }
  it('rotating a selection that includes a placeholder returns a result instead of throwing', () => {
    const ids = [withGhost.instances[1]!.id, 'ghost']
    let r: unknown
    expect(() => { r = rotateParts(withGhost, ids, c, 1) }).not.toThrow()
    void r
  })
  it('duplicate selection with a placeholder', () => {
    expect(() => duplicateParts(withGhost, [withGhost.instances[1]!.id, 'ghost'], c)).not.toThrow()
  })
  it('painting then keeps the connection of a placeholder to the car', () => {
    const connected: CarDocument = { ...withGhost, connections: [...withGhost.connections, { id: 'x', a: { instanceId: 'ghost', connectorId: 'k0_0' }, b: { instanceId: withGhost.instances[0]!.id, connectorId: 's0_0_2' }, type: 'stud' }] }
    const r = paintParts(connected, [withGhost.instances[1]!.id], 'red', c)
    if (!r.ok) throw new Error('x')
    expect(r.doc.connections.some(k => k.a.instanceId === 'ghost' || k.b.instanceId === 'ghost')).toBe(true)
  })
  it('delete ok', () => {
    const r = deleteParts(withGhost, ['ghost'], c)
    expect(r.ok).toBe(true)
  })
})

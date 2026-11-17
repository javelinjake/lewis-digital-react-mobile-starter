import type { PartCategory, PartDefinition } from './types'
import { PART_DEFINITIONS } from './parts'

export interface PartCatalog {
  get: (id: string) => PartDefinition | undefined
  list: () => readonly PartDefinition[]
  byCategory: (category: PartCategory) => PartDefinition[]
}

export const CATEGORY_ORDER: readonly PartCategory[] = ['bricks', 'plates', 'beams', 'shaped', 'fittings', 'wheels', 'details']

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  bricks: 'Bricks',
  plates: 'Plates',
  beams: 'Beams',
  shaped: 'Shapes',
  fittings: 'Chassis',
  wheels: 'Wheels',
  details: 'Details',
}

export function createCatalog(definitions: readonly PartDefinition[] = PART_DEFINITIONS): PartCatalog {
  const map = new Map(definitions.map(def => [def.id, def]))
  return {
    get: id => map.get(id),
    list: () => definitions,
    byCategory: category => definitions.filter(def => def.category === category),
  }
}

/** The shipped catalogue. Unlimited copies of every part are always available. */
export const catalog: PartCatalog = createCatalog()

export const getPart = (id: string): PartDefinition | undefined => catalog.get(id)

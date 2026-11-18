import type { PartCatalog } from '../catalog/catalog'
import type { CarDocument } from './types'

export interface Assemblies {
  /** Instance id lists, largest first. */
  components: string[][]
  /** Index into `components` of the assembly the car drives, or -1 for an empty car. */
  mainIndex: number
  /** instanceId -> component index. */
  componentOf: Map<string, number>
}

/** Connected assemblies from stored connections. Missing parts still belong to an assembly. */
export function computeAssemblies(doc: Pick<CarDocument, 'instances' | 'connections' | 'rootInstanceId'>, catalog?: PartCatalog): Assemblies {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  for (const inst of doc.instances) parent.set(inst.id, inst.id)
  for (const c of doc.connections) {
    if (!parent.has(c.a.instanceId) || !parent.has(c.b.instanceId))
      continue
    const ra = find(c.a.instanceId)
    const rb = find(c.b.instanceId)
    if (ra !== rb)
      parent.set(ra, rb)
  }

  const groups = new Map<string, string[]>()
  for (const inst of doc.instances) {
    const root = find(inst.id)
    const list = groups.get(root)
    if (list)
      list.push(inst.id)
    else
      groups.set(root, [inst.id])
  }

  const hasWheel = (ids: string[]) => ids.some((id) => {
    const inst = doc.instances.find(i => i.id === id)
    return inst ? Boolean(catalog?.get(inst.defId)?.wheel) : false
  })

  const rootKey = doc.rootInstanceId && parent.has(doc.rootInstanceId) ? find(doc.rootInstanceId) : null
  const components = [...groups.values()].sort((a, b) => {
    const wheelDiff = Number(hasWheel(b)) - Number(hasWheel(a))
    return b.length - a.length || wheelDiff
  })

  const componentOf = new Map<string, number>()
  components.forEach((ids, index) => ids.forEach(id => componentOf.set(id, index)))

  let mainIndex = components.length === 0 ? -1 : 0
  if (rootKey) {
    const rootIndex = componentOf.get(doc.rootInstanceId!)
    if (rootIndex !== undefined)
      mainIndex = rootIndex
  }
  // If the first-placed piece was moved away from the car, drive the biggest assembly that has wheels
  // instead of treating the whole car as loose.
  if (catalog && mainIndex >= 0 && !hasWheel(components[mainIndex]!)) {
    const wheeled = components.findIndex(ids => hasWheel(ids))
    if (wheeled >= 0)
      mainIndex = wheeled
  }
  return { components, mainIndex, componentOf }
}

/** Instance ids that are not in the main assembly. Detached assemblies are visibly identified in the editor. */
export function looseInstanceIds(assemblies: Assemblies): Set<string> {
  const loose = new Set<string>()
  assemblies.components.forEach((ids, index) => {
    if (index !== assemblies.mainIndex)
      ids.forEach(id => loose.add(id))
  })
  return loose
}

/** Instances in the chosen driving assembly. */
export function mainAssemblyIds(assemblies: Assemblies): Set<string> {
  return new Set(assemblies.mainIndex >= 0 ? assemblies.components[assemblies.mainIndex]! : [])
}

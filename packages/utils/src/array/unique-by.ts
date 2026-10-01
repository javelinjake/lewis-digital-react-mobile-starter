export function uniqueBy<T, K>(items: T[], getKey: (item: T) => K): T[] {
  const seen = new Set<K>()
  const result: T[] = []

  for (const item of items) {
    const key = getKey(item)
    if (seen.has(key))
      continue
    seen.add(key)
    result.push(item)
  }

  return result
}

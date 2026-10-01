export function createQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '')
      continue
    if (Array.isArray(value)) {
      for (const item of value)
        search.append(key, String(item))
    }
    else {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

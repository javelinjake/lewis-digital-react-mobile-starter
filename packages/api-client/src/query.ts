export type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [key: string]: QueryValue }

/**
 * Payload's REST query syntax: nested objects become brackets, arrays become indexes.
 * `{ where: { owner: { equals: 3 } }, limit: 10 }` -> `where[owner][equals]=3&limit=10`.
 */
export function toQueryString(params: Record<string, QueryValue>): string {
  const pairs: string[] = []

  const visit = (prefix: string, value: QueryValue) => {
    if (value === undefined)
      return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(`${prefix}[${index}]`, item))
      return
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value))
        visit(`${prefix}[${key}]`, inner)
      return
    }
    pairs.push(`${encodeURIComponent(prefix).replace(/%5B/g, '[').replace(/%5D/g, ']')}=${encodeURIComponent(value === null ? '' : String(value))}`)
  }

  for (const [key, value] of Object.entries(params))
    visit(key, value)

  return pairs.join('&')
}

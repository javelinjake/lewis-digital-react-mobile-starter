import type { Endpoint } from 'payload'

/**
 * Payload sends `/api/<slug>/...` to that collection's own `endpoints` list and never looks at the top-level
 * list, so a top-level endpoint whose first path segment is a collection or global slug can never be reached.
 * It would just return 404. Fail at startup with the reason instead.
 */
export function assertNoShadowedEndpoints(endpoints: ReadonlyArray<Pick<Endpoint, 'path' | 'method'>>, slugs: readonly string[]) {
  for (const endpoint of endpoints) {
    const first = endpoint.path.split('/').filter(Boolean)[0]
    if (first && slugs.includes(first)) {
      throw new Error(
        `The endpoint ${endpoint.method.toUpperCase()} ${endpoint.path} can never be reached: Payload routes /api/${first}/... `
        + `to the "${first}" collection's own endpoints only. Use a different first path segment (for example /actions/...), `
        + `or declare it in that collection's \`endpoints\`.`,
      )
    }
  }
}

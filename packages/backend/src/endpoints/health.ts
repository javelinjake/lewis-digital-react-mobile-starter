import type { Endpoint } from 'payload'

/** `GET /api/health`: 200 when the database answers. Used by deploy checks and CI. */
export const healthEndpoint: Endpoint = {
  path: '/health',
  method: 'get',
  handler: async (req) => {
    try {
      await req.payload.find({ collection: 'action-throttles', limit: 0, depth: 0, overrideAccess: true })
      return Response.json({ ok: true })
    }
    catch {
      return Response.json({ ok: false }, { status: 503 })
    }
  },
}

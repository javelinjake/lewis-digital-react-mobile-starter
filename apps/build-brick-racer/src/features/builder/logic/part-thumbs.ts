/**
 * Tray thumbnails. Each part is rendered once with the shared offscreen renderer, queued one at a time
 * so the tray stays responsive, and cached. Until the render lands (or if WebGL is unavailable) a cheap
 * inline SVG footprint is shown instead.
 */
import type { PartDefinition } from '@/game/catalog/types'
import { createEmptyDoc, defaultContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { colourHex } from '@/game/catalog/palette'
import { renderCarThumbnail } from '@/render'

const rendered = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
let chain: Promise<unknown> = Promise.resolve()

const keyOf = (defId: string, colour: string) => `${defId}:${colour}`

/** Instant placeholder: the part's footprint with studs, or a wheel disc. */
export function fallbackPartThumb(def: PartDefinition, colour = 'orange'): string {
  const hex = colourHex(colour)
  const [sx, , sz] = def.size
  let body: string
  if (def.wheel) {
    body = `<circle cx="60" cy="42" r="30" fill="#1c1c20"/><circle cx="60" cy="42" r="13" fill="#ffd21f"/><circle cx="60" cy="42" r="4" fill="#fff6"/>`
  }
  else {
    const unit = Math.min(80 / Math.max(sx, 1), 56 / Math.max(sz, 1), 18)
    const w = sx * unit
    const h = sz * unit
    const x0 = 60 - w / 2
    const y0 = 42 - h / 2
    const studs: string[] = []
    for (let i = 0; i < sx; i++) {
      for (let j = 0; j < sz; j++)
        studs.push(`<circle cx="${(x0 + (i + 0.5) * unit).toFixed(1)}" cy="${(y0 + (j + 0.5) * unit).toFixed(1)}" r="${(unit * 0.3).toFixed(1)}" fill="#fff" fill-opacity=".35"/>`)
    }
    body = `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${hex}"/>${studs.join('')}`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="84" viewBox="0 0 120 84">${body}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function cachedPartThumb(defId: string, colour: string): string | null {
  return rendered.get(keyOf(defId, colour)) ?? null
}

/** Render a thumbnail for one part (queued). Resolves to null when rendering is unavailable. */
export function requestPartThumb(def: PartDefinition, colour: string): Promise<string | null> {
  const key = keyOf(def.id, colour)
  const hit = rendered.get(key)
  if (hit)
    return Promise.resolve(hit)
  const running = inflight.get(key)
  if (running)
    return running
  const job = chain.then(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    const doc = createEmptyDoc(defaultContext, 'thumb')
    doc.instances = [{ id: 'thumb', defId: def.id, defVersion: def.version, pos: [0, 0, 0], rot: 0, colour }]
    const url = await renderCarThumbnail(doc, catalog, { size: 168 })
    if (url)
      rendered.set(key, url)
    inflight.delete(key)
    return url
  })
  chain = job.catch(() => null)
  inflight.set(key, job)
  return job
}

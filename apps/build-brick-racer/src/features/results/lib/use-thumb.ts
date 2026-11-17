import type { CarDocument } from '@/game/build/types'
import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

/** Small rendered picture of a snapshot's car, cached per revision. Null until ready or if rendering fails. */
export function useCarPicture(doc: CarDocument | null | undefined, size = 300): string | null {
  const key = doc ? `${doc.carId}-${doc.revisionId}-${size}` : ''
  const [url, setUrl] = useState<string | null>(key ? (cache.get(key) ?? null) : null)

  useEffect(() => {
    if (!doc || !key) {
      setUrl(null)
      return
    }
    const hit = cache.get(key)
    if (hit) {
      setUrl(hit)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const render = await import('@/render')
        const { catalog } = await import('@/game/catalog/catalog')
        const rendered = await render.renderCarThumbnail(doc, catalog, { size, background: 'mat' }) ?? render.fallbackThumbnail(doc.name)
        cache.set(key, rendered)
        if (!cancelled)
          setUrl(rendered)
      }
      catch {
        if (!cancelled)
          setUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc, key, size])

  return url
}

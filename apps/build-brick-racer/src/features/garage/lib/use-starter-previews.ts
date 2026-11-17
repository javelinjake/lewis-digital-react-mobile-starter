import { useEffect, useState } from 'react'
import { createEmptyDoc, defaultContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'

type StarterId = 'racer' | 'buggy'

const cache = new Map<StarterId, string>()

/** Rendered previews of the two starter cars (never saved). Falls back to a generated image. */
export function useStarterPreviews(size = 360): Record<StarterId, string | null> {
  const [urls, setUrls] = useState<Record<StarterId, string | null>>({
    racer: cache.get('racer') ?? null,
    buggy: cache.get('buggy') ?? null,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const render = await import('@/render').catch(() => null)
      for (const id of ['racer', 'buggy'] as const) {
        if (cache.has(id))
          continue
        const doc = buildStarter(id, defaultContext)
        const url = (render ? await render.renderCarThumbnail(doc, catalog, { size }) : null) ?? render?.fallbackThumbnail(doc.name) ?? null
        if (url)
          cache.set(id, url)
        if (!cancelled && url)
          setUrls(prev => ({ ...prev, [id]: url }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [size])

  return urls
}

export const emptyStarterDoc = () => createEmptyDoc(defaultContext, 'My car')

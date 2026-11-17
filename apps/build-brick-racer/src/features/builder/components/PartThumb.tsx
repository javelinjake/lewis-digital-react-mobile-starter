import type { PartDefinition } from '@/game/catalog/types'
import { useEffect, useState } from 'react'
import { cachedPartThumb, fallbackPartThumb, requestPartThumb } from '@/features/builder/logic/part-thumbs'

/** Part picture: an instant SVG footprint, upgraded to a rendered image once it is ready. */
export function PartThumb({ def, colour = 'orange', size = 56 }: { def: PartDefinition, colour?: string, size?: number }) {
  const [src, setSrc] = useState<string | null>(() => cachedPartThumb(def.id, colour))

  useEffect(() => {
    let cancelled = false
    void requestPartThumb(def, colour).then((url) => {
      if (!cancelled && url)
        setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [def, colour])

  return (
    <img
      src={src ?? fallbackPartThumb(def, colour)}
      alt=""
      width={size * 1.4}
      height={size}
      draggable={false}
      className="pointer-events-none select-none object-contain"
      style={{ width: size * 1.4, height: size }}
    />
  )
}

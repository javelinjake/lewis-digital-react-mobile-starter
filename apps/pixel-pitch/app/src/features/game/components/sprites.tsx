import type { Player, Position } from '@ld/pixel-pitch-core'
import type { Layer } from '../lib/compose'
import { crestParts } from '@ld/pixel-pitch-core'
import { useEffect, useState } from 'react'
import { art } from '../lib/art'
import { composeSprite } from '../lib/compose'
import { playerLayers } from '../lib/player-layers'

function useComposed(layers: readonly Layer[], width: number, height: number) {
  const key = JSON.stringify(layers)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void composeSprite(layers, width, height).then((value) => {
      if (live)
        setUrl(value)
    })
    return () => {
      live = false
    }
    // `key` stands for `layers`, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width, height])
  return url
}

/** A 12×16 player in the club's kit, scaled by a whole number. */
export function PlayerSprite({ player, kit, role, scale = 3 }: { player: Player, kit: readonly [string, string], role?: Position, scale?: number }) {
  const url = useComposed(playerLayers(player.sprite, kit, role), 12, 16)
  return url
    ? <img src={url} width={12 * scale} height={16 * scale} alt="" className="pixel" />
    : <span style={{ width: 12 * scale, height: 16 * scale }} className="inline-block" />
}

/** A club crest: a base shape in the kit colours with an emblem on top. */
export function Crest({ crest, kit, scale = 3, label }: { crest: number, kit: readonly [string, string], scale?: number, label?: string }) {
  const { base, emblem } = crestParts(crest)
  const url = useComposed([{ path: `crests/base_${base}_template.png`, kit }, { path: `crests/emblem_${emblem}.png`, x: 4, y: 4 }], 16, 18)
  return url
    ? <img src={url} width={16 * scale} height={18 * scale} alt={label ?? ''} className="pixel" />
    : <span style={{ width: 16 * scale, height: 18 * scale }} className="inline-block" />
}

/** A plain sprite from the pack, e.g. an icon, scaled by a whole number. */
export function Icon({ path, size = 12, scale = 2, label }: { path: string, size?: number, scale?: number, label?: string }) {
  return <img src={art(path)} width={size * scale} height={size * scale} alt={label ?? ''} className="pixel inline-block" />
}

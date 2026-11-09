import type { Player, Position } from '@ld/pixel-pitch-core'
import type { Layer } from './compose'
import { HAIR_COLOURS, HAIR_STYLES } from '@ld/pixel-pitch-core'

/** Draw order from the asset pack: body, shirt, shorts, socks, boots, hair, then gloves for a keeper. */
export function playerLayers(sprite: Player['sprite'], kit: readonly [string, string], role?: Position): Layer[] {
  const layers: Layer[] = [
    { path: `players/body/body_skin${sprite.skin + 1}.png` },
    { path: 'players/kit/kit_plain_template.png', kit },
    { path: 'players/kit/shorts_template.png', kit },
    { path: 'players/kit/socks_template.png', kit },
    { path: 'players/kit/boots.png' },
  ]
  const style = HAIR_STYLES[sprite.hairStyle]
  if (style && style !== 'bald')
    layers.push({ path: `players/hair/hair_${style}_${HAIR_COLOURS[sprite.hairColour]}.png` })
  if (role === 'GK')
    layers.push({ path: 'players/kit/gk_gloves.png' })
  return layers
}

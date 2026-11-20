import { clubColourSwaps, loadImage, recolorKey, swapColours } from '@ld/game'
import { art } from './art'

export interface Layer {
  path: string
  /** Swap the template's key colours for these. */
  kit?: readonly [primary: string, secondary: string]
  /** Where the layer's top-left corner goes. 0, 0 by default. */
  x?: number
  y?: number
}

const images = new Map<string, Promise<HTMLImageElement>>()
const composed = new Map<string, Promise<string>>()

function image(path: string) {
  let pending = images.get(path)
  if (!pending) {
    pending = loadImage(art(path))
    images.set(path, pending)
  }
  return pending
}

/**
 * Draws layers bottom to top into one small image (12×16 for a player), recolouring kit templates, and returns it as
 * a data URL. The same layers in the same colours are drawn once per session.
 */
export function composeSprite(layers: readonly Layer[], width: number, height: number): Promise<string> {
  const key = `${width}x${height}:${layers.map(layer => `${layer.kit ? recolorKey(layer.path, layer.kit[0], layer.kit[1]) : layer.path}@${layer.x ?? 0},${layer.y ?? 0}`).join('+')}`
  let pending = composed.get(key)
  if (!pending) {
    pending = (async () => {
      const loaded = await Promise.all(layers.map(layer => image(layer.path)))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.imageSmoothingEnabled = false
      for (const [index, layer] of layers.entries()) {
        if (!layer.kit) {
          context.drawImage(loaded[index], layer.x ?? 0, layer.y ?? 0)
          continue
        }
        const scratch = document.createElement('canvas')
        scratch.width = width
        scratch.height = height
        const scratchContext = scratch.getContext('2d', { willReadFrequently: true })!
        scratchContext.drawImage(loaded[index], 0, 0)
        const pixels = scratchContext.getImageData(0, 0, width, height)
        pixels.data.set(swapColours(pixels.data, clubColourSwaps(layer.kit[0], layer.kit[1])))
        scratchContext.putImageData(pixels, 0, 0)
        context.drawImage(scratch, layer.x ?? 0, layer.y ?? 0)
      }
      return canvas.toDataURL()
    })()
    composed.set(key, pending)
  }
  return pending
}

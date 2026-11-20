/**
 * Kit and crest templates use key colours: pure red (#ff0000) marks the club's primary colour and pure green
 * (#00ff00) the secondary. Swap them for the club's colours on a small offscreen canvas, then cache the result:
 * 12×16 pixels is nothing to repaint, but doing it every frame for 5 players would be.
 */
export type Rgb = readonly [number, number, number]

export const KEY_PRIMARY: Rgb = [255, 0, 0]
export const KEY_SECONDARY: Rgb = [0, 255, 0]

export function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, '')
  const full = clean.length === 3 ? [...clean].map(char => char + char).join('') : clean
  if (!/^[0-9a-f]{6}$/i.test(full))
    throw new Error(`Not a colour: "${hex}"`)
  return [Number.parseInt(full.slice(0, 2), 16), Number.parseInt(full.slice(2, 4), 16), Number.parseInt(full.slice(4, 6), 16)]
}

/** Returns a copy of RGBA pixel data with each `from` colour replaced by its `to`. Transparent pixels are left alone. */
export function swapColours(pixels: Uint8ClampedArray, swaps: ReadonlyArray<readonly [from: Rgb, to: Rgb]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels)
  for (let index = 0; index < out.length; index += 4) {
    if (out[index + 3] === 0)
      continue
    for (const [from, to] of swaps) {
      if (out[index] === from[0] && out[index + 1] === from[1] && out[index + 2] === from[2]) {
        out[index] = to[0]
        out[index + 1] = to[1]
        out[index + 2] = to[2]
        break
      }
    }
  }
  return out
}

export function clubColourSwaps(primary: string, secondary: string) {
  return [[KEY_PRIMARY, hexToRgb(primary)], [KEY_SECONDARY, hexToRgb(secondary)]] as const
}

/** Cache key for a recoloured sprite: the same sprite in the same colours is painted once. */
export function recolorKey(sprite: string, primary: string, secondary: string) {
  return `${sprite}|${primary.toLowerCase()}|${secondary.toLowerCase()}`
}

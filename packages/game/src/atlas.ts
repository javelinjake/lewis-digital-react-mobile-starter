/**
 * Sprite sheets come as a PNG plus a TexturePacker "hash" JSON atlas:
 * `{ frames: { name: { frame: { x, y, w, h }, sourceSize } }, meta: { image, size } }`.
 */
export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Atlas {
  /** File name of the sheet image, as written in the atlas. */
  image: string
  width: number
  height: number
  frames: Readonly<Record<string, FrameRect>>
}

interface RawAtlas {
  frames: Record<string, { frame: FrameRect }>
  meta: { image: string, size: { w: number, h: number } }
}

export function parseAtlas(raw: unknown): Atlas {
  const atlas = raw as Partial<RawAtlas> | null
  if (!atlas?.frames || !atlas.meta?.image || !atlas.meta.size)
    throw new Error('Not a TexturePacker hash atlas: expected frames and meta.image/meta.size.')

  const frames: Record<string, FrameRect> = {}
  for (const [name, entry] of Object.entries(atlas.frames)) {
    const { x, y, w, h } = entry.frame
    frames[name] = { x, y, w, h }
  }
  return { image: atlas.meta.image, width: atlas.meta.size.w, height: atlas.meta.size.h, frames }
}

export function getFrame(atlas: Atlas, name: string): FrameRect {
  const frame = atlas.frames[name]
  if (!frame)
    throw new Error(`No frame "${name}" in atlas ${atlas.image}.`)
  return frame
}

/** Frames named `prefix_0`, `prefix_1`, … in order. An animation is just that list played at a fixed interval. */
export function getAnimation(atlas: Atlas, prefix: string): FrameRect[] {
  const frames: FrameRect[] = []
  for (let index = 0; atlas.frames[`${prefix}_${index}`]; index++)
    frames.push(atlas.frames[`${prefix}_${index}`])
  if (frames.length === 0)
    throw new Error(`No frames named ${prefix}_0 in atlas ${atlas.image}.`)
  return frames
}

export interface LoadedAtlas {
  atlas: Atlas
  image: HTMLImageElement
}

export async function loadAtlas(jsonUrl: string, imageUrl: string): Promise<LoadedAtlas> {
  const [json, image] = await Promise.all([fetch(jsonUrl).then(response => response.json()), loadImage(imageUrl)])
  return { atlas: parseAtlas(json), image }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image ${url}`))
    image.src = url
  })
}

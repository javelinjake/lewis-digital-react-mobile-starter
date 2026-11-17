/** Procedural canvas textures, generated once and cached. Returns null when no 2D canvas exists (tests). */
import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture | null>()

export function canvasTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  opts: { repeat?: boolean, srgb?: boolean, anisotropy?: number } = {},
): THREE.CanvasTexture | null {
  if (cache.has(key))
    return cache.get(key)!
  let texture: THREE.CanvasTexture | null = null
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (ctx) {
        draw(ctx, size)
        texture = new THREE.CanvasTexture(canvas)
        if (opts.repeat ?? true) {
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
        }
        texture.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
        texture.anisotropy = opts.anisotropy ?? 4
        texture.needsUpdate = true
      }
    }
  }
  catch {
    texture = null
  }
  cache.set(key, texture)
  return texture
}

/** Seeded pseudo random so textures look the same every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function disposeTextures(): void {
  for (const t of cache.values()) t?.dispose()
  cache.clear()
}

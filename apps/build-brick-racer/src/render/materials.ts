/** Shared, cached materials. Textures and materials are created lazily and reused across every model. */
import * as THREE from 'three'
import { GLASS_HEX, TYRE_HEX } from '@/game/catalog/palette'

export type Slot = 'primary' | 'tyre' | 'glass'

const plastic = new Map<string, THREE.MeshStandardMaterial>()
let rubber: THREE.MeshStandardMaterial | null = null
let glass: THREE.MeshStandardMaterial | null = null
let placeholder: THREE.MeshBasicMaterial | null = null
const ghosts = new Map<string, THREE.MeshStandardMaterial>()

/** Glossy ABS plastic in a palette colour. */
export function plasticMaterial(hex: string): THREE.MeshStandardMaterial {
  let m = plastic.get(hex)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.3, metalness: 0, envMapIntensity: 1 })
    plastic.set(hex, m)
  }
  return m
}

/** Black rubber for tyres and dark accents. */
export function rubberMaterial(): THREE.MeshStandardMaterial {
  rubber ??= new THREE.MeshStandardMaterial({ color: new THREE.Color(TYRE_HEX), roughness: 0.78, metalness: 0 })
  return rubber
}

/** Tinted translucent canopy glass. */
export function glassMaterial(): THREE.MeshStandardMaterial {
  glass ??= new THREE.MeshStandardMaterial({
    color: new THREE.Color(GLASS_HEX),
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })
  return glass
}

/** Translucent magenta box for parts whose definition is missing. */
export function placeholderMaterial(): THREE.MeshBasicMaterial {
  placeholder ??= new THREE.MeshBasicMaterial({ color: 0xFF2BD6, transparent: true, opacity: 0.45, depthWrite: false })
  return placeholder
}

/** Placement preview: green when valid, red when not. */
export function ghostMaterial(state: 'valid' | 'invalid'): THREE.MeshStandardMaterial {
  let m = ghosts.get(state)
  if (!m) {
    const colour = state === 'valid' ? 0x4DFF8A : 0xFF4D5E
    m = new THREE.MeshStandardMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
    ghosts.set(state, m)
  }
  return m
}

export function materialForSlot(slot: Slot, hex: string): THREE.Material {
  if (slot === 'tyre')
    return rubberMaterial()
  if (slot === 'glass')
    return glassMaterial()
  return plasticMaterial(hex)
}

/** Colour with its saturation reduced, used to grey out detached pieces. */
export function desaturate(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s * (1 - amount), hsl.l * 0.92 + 0.04)
  return `#${c.getHexString()}`
}

export function disposeMaterials(): void {
  for (const m of plastic.values()) m.dispose()
  plastic.clear()
  for (const m of ghosts.values()) m.dispose()
  ghosts.clear()
  rubber?.dispose()
  glass?.dispose()
  placeholder?.dispose()
  rubber = null
  glass = null
  placeholder = null
}

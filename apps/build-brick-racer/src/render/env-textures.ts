/** Procedural surface textures and materials for environments. Generated once, cached, tinted per box. */
import type { EnvironmentDefinition } from '@/game/env/types'
import * as THREE from 'three'
import { canvasTexture, rng } from './textures'

export type EnvMaterialKey = NonNullable<NonNullable<EnvironmentDefinition['boxes'][number]['look']>['material']>

interface Surface {
  /** Metres covered by one texture repeat. */
  worldSize: number
  roughness: number
  metalness: number
  draw?: (ctx: CanvasRenderingContext2D, size: number) => void
  size?: number
}

function speckle(ctx: CanvasRenderingContext2D, size: number, seed: number, count: number, colours: string[], maxR: number) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colours[Math.floor(r() * colours.length)]!
    ctx.globalAlpha = 0.25 + r() * 0.5
    ctx.beginPath()
    ctx.arc(r() * size, r() * size, 0.6 + r() * maxR, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const SURFACES: Record<EnvMaterialKey, Surface> = {
  tile: {
    worldSize: 1.2,
    roughness: 0.28,
    metalness: 0,
    size: 512,
    draw(ctx, s) {
      const h = s / 2
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#e6e0d2' : '#d5cebc'
          ctx.fillRect(x * h, y * h, h, h)
        }
      }
      speckle(ctx, s, 7, 500, ['#cfc7b4', '#fff9ec'], 1.6)
      ctx.strokeStyle = '#8f897c'
      ctx.lineWidth = 5
      for (let i = 0; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(i * h, 0)
        ctx.lineTo(i * h, s)
        ctx.moveTo(0, i * h)
        ctx.lineTo(s, i * h)
        ctx.stroke()
      }
    },
  },
  plastic: {
    worldSize: 0.5,
    roughness: 0.32,
    metalness: 0,
    size: 256,
    draw(ctx, s) {
      ctx.fillStyle = '#f7f7f7'
      ctx.fillRect(0, 0, s, s)
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.lineWidth = 3
      ctx.strokeRect(1, 1, s - 2, s - 2)
      ctx.fillStyle = 'rgba(0,0,0,0.07)'
      for (let i = 0; i < 4; i++) ctx.fillRect(0, (i + 0.5) * (s / 4) - 2, s, 4)
      speckle(ctx, s, 11, 80, ['#ffffff', '#dddddd'], 1.4)
    },
  },
  grass: {
    worldSize: 2,
    roughness: 0.92,
    metalness: 0,
    size: 512,
    draw(ctx, s) {
      ctx.fillStyle = '#5e9a3c'
      ctx.fillRect(0, 0, s, s)
      const blobs = rng(77)
      for (let i = 0; i < 26; i++) {
        const x = blobs() * s
        const y = blobs() * s
        const g = ctx.createRadialGradient(x, y, 2, x, y, 60 + blobs() * 70)
        g.addColorStop(0, i % 2 === 0 ? 'rgba(40,90,20,0.38)' : 'rgba(150,200,80,0.34)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, s, s)
      }
      speckle(ctx, s, 3, 900, ['#4c8530', '#76b14b', '#3e7228', '#86c257'], 3)
      const r = rng(5)
      ctx.lineWidth = 1.5
      for (let i = 0; i < 1600; i++) {
        const x = r() * s
        const y = r() * s
        ctx.strokeStyle = ['#a4d76e', '#3a6e25', '#8cc75d'][Math.floor(r() * 3)]!
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 8)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    },
  },
  mud: {
    worldSize: 1.6,
    roughness: 0.32,
    metalness: 0,
    size: 512,
    draw(ctx, s) {
      ctx.fillStyle = '#5a3a22'
      ctx.fillRect(0, 0, s, s)
      speckle(ctx, s, 9, 260, ['#43291a', '#6e4a2c', '#7b5434', '#35200f'], 14)
      speckle(ctx, s, 13, 40, ['#9a7650', '#8d6a45'], 7)
      const r = rng(21)
      for (let i = 0; i < 14; i++) {
        const g = ctx.createRadialGradient(r() * s, r() * s, 1, r() * s, r() * s, 40 + r() * 40)
        g.addColorStop(0, 'rgba(180,150,120,0.35)')
        g.addColorStop(1, 'rgba(180,150,120,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, s, s)
      }
    },
  },
  wood: {
    worldSize: 0.6,
    roughness: 0.55,
    metalness: 0,
    size: 512,
    draw(ctx, s) {
      const planks = 4
      const h = s / planks
      const r = rng(17)
      for (let i = 0; i < planks; i++) {
        const l = 52 + r() * 14
        ctx.fillStyle = `hsl(${28 + r() * 6}, ${46 + r() * 10}%, ${l - 6}%)`
        ctx.fillRect(0, i * h, s, h)
        ctx.strokeStyle = 'rgba(70,40,15,0.30)'
        ctx.lineWidth = 1.2
        for (let g = 0; g < 14; g++) {
          const y = i * h + 4 + r() * (h - 8)
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 6, s * 0.6, y + (r() - 0.5) * 6, s, y + (r() - 0.5) * 4)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(40,22,8,0.55)'
        ctx.fillRect(0, (i + 1) * h - 3, s, 3)
      }
    },
  },
  cabinet: {
    worldSize: 1.2,
    roughness: 0.4,
    metalness: 0,
    size: 256,
    draw(ctx, s) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, s, s)
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 6
      ctx.strokeRect(20, 20, s - 40, s - 40)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 3
      ctx.strokeRect(27, 27, s - 54, s - 54)
    },
  },
  metal: {
    worldSize: 0.8,
    roughness: 0.34,
    metalness: 0.85,
    size: 256,
    draw(ctx, s) {
      ctx.fillStyle = '#cfd3d8'
      ctx.fillRect(0, 0, s, s)
      const r = rng(33)
      for (let i = 0; i < 260; i++) {
        ctx.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(80,90,100,0.25)'
        ctx.beginPath()
        const y = r() * s
        ctx.moveTo(0, y)
        ctx.lineTo(s, y + (r() - 0.5) * 2)
        ctx.stroke()
      }
    },
  },
  soil: {
    worldSize: 1.8,
    roughness: 0.95,
    metalness: 0,
    size: 512,
    draw(ctx, s) {
      ctx.fillStyle = '#6b4a30'
      ctx.fillRect(0, 0, s, s)
      speckle(ctx, s, 41, 1400, ['#503420', '#82603f', '#3d2716', '#946f4a'], 3.2)
      speckle(ctx, s, 43, 70, ['#8c8a86', '#a09c94'], 4)
    },
  },
  ceramic: { worldSize: 1, roughness: 0.12, metalness: 0 },
  plain: { worldSize: 1, roughness: 0.62, metalness: 0 },
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

export const worldSizeFor = (key: EnvMaterialKey): number => SURFACES[key].worldSize

/** Tinted procedural material for an environment surface. */
export function envMaterial(key: EnvMaterialKey, colour: string): THREE.MeshStandardMaterial {
  const id = `${key}|${colour}`
  let m = materials.get(id)
  if (!m) {
    const s = SURFACES[key]
    const map = s.draw ? canvasTexture(`env-${key}`, s.size ?? 256, s.draw) : null
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), map, roughness: s.roughness, metalness: s.metalness })
    materials.set(id, m)
  }
  return m
}

const propMaterials = new Map<string, THREE.MeshStandardMaterial>()

export function propMaterial(colour: string): THREE.MeshStandardMaterial {
  let m = propMaterials.get(colour)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.5, metalness: 0.05 })
    propMaterials.set(colour, m)
  }
  return m
}

/** Vertical gradient used as the sky backdrop. */
export function skyTexture(top: string, bottom: string): THREE.CanvasTexture | null {
  return canvasTexture(`sky-${top}-${bottom}`, 256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }, { repeat: false, anisotropy: 1 })
}

export function checkerTexture(): THREE.CanvasTexture | null {
  return canvasTexture('checker', 128, (ctx, s) => {
    const n = 8
    const c = s / n
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111'
        ctx.fillRect(x * c, y * c, c, c)
      }
    }
  })
}

export function disposeEnvMaterials(): void {
  for (const m of materials.values()) m.dispose()
  for (const m of propMaterials.values()) m.dispose()
  materials.clear()
  propMaterials.clear()
}

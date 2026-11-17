import type { Gate, ZoneBox } from './types'

export function gate(id: string, kind: Gate['kind'], x: number, surfaceY: number, z: number, halfWidth: number, yaw = 0, label?: string): Gate {
  return {
    id,
    kind,
    centre: [x, surfaceY + 0.9, z],
    yaw,
    halfWidth,
    halfHeight: 1.2,
    ...(label ? { label } : {}),
  }
}

export function zone(x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw = 0): ZoneBox {
  return { centre: [x, y, z], half: [hx, hy, hz], yaw }
}

/** A generous spawn volume: the car must fit inside its footprint. */
export const spawn = (x: number, y: number, z: number, yaw = 0, hx = 1.6, hz = 2.2): ZoneBox => zone(x, y + 1, z, hx, 1.2, hz, yaw)

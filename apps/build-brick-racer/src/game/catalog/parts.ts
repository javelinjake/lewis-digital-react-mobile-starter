/**
 * V1 part catalogue: 36 definitions. Source-controlled data, separate from UI.
 * Sizes are lattice units (studs, plates, studs). One brick is three plates.
 * Connector positions are DOUBLED lattice coordinates (see lattice.ts).
 */
import type { BoxI, V3I } from '../lattice'
import type { ConnectorDefinition, PartCategory, PartDefinition, TyreId, VisualShape } from './types'
import { UNITS } from '../units'

/** Kilograms per lattice cell (1 stud x 1 stud x 1 plate) of solid plastic at toy scale. */
export const DENSITY_KG_PER_CELL = 0.0067

const ALL_ROT = [0, 1, 2, 3] as const

const box = (min: V3I, max: V3I): BoxI => ({ min, max })
const full = (size: V3I): BoxI => box([0, 0, 0], size)
function cellCount(boxes: BoxI[]) {
  return boxes.reduce((sum, b) => sum + (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]), 0)
}

type Cell = readonly [number, number]

function allCells(sx: number, sz: number): Cell[] {
  const out: Cell[] = []
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) out.push([x, z])
  }
  return out
}

function studs(sy: number, cells: readonly Cell[], y = sy): ConnectorDefinition[] {
  return cells.map(([x, z]) => ({
    id: `s${x}_${z}_${y}`,
    type: 'stud' as const,
    pos2: [2 * x + 1, 2 * y, 2 * z + 1] as V3I,
    dir: [0, 1, 0] as V3I,
    tags: ['stud'],
  }))
}

function sockets(cells: readonly Cell[]): ConnectorDefinition[] {
  return cells.map(([x, z]) => ({
    id: `k${x}_${z}`,
    type: 'socket' as const,
    pos2: [2 * x + 1, 0, 2 * z + 1] as V3I,
    dir: [0, -1, 0] as V3I,
    tags: ['stud'],
  }))
}

interface Spec {
  id: string
  label: string
  category: PartCategory
  size: V3I
  shape: VisualShape
  boxes?: BoxI[]
  topStuds?: readonly Cell[] | 'all' | 'none'
  bottomSockets?: readonly Cell[] | 'all' | 'none'
  extra?: ConnectorDefinition[]
  /** Mass multiplier on the solid cell mass. */
  density?: number
  fill?: number
  massKg?: number
  mirror?: string | 'self' | null
  structural?: boolean
  slots?: string[]
  wheel?: PartDefinition['wheel']
  aero?: PartDefinition['aero']
}

function define(spec: Spec): PartDefinition {
  const [sx, sy, sz] = spec.size
  const boxes = spec.boxes ?? [full(spec.size)]
  const top = spec.topStuds === undefined || spec.topStuds === 'all' ? allCells(sx, sz) : spec.topStuds === 'none' ? [] : spec.topStuds
  const bottom = spec.bottomSockets === undefined || spec.bottomSockets === 'all' ? allCells(sx, sz) : spec.bottomSockets === 'none' ? [] : spec.bottomSockets
  const connectors = [...studs(sy, top), ...sockets(bottom), ...(spec.extra ?? [])]
  const massKg = spec.massKg ?? Math.round(cellCount(boxes) * DENSITY_KG_PER_CELL * (spec.density ?? 1) * (spec.fill ?? 1) * 10000) / 10000

  return {
    id: spec.id,
    version: 1,
    category: spec.category,
    label: spec.label,
    size: spec.size,
    boxes,
    connectors,
    allowedRotations: [...ALL_ROT],
    massKg,
    mirror: spec.mirror === undefined ? 'self' : spec.mirror,
    shape: spec.shape,
    materialSlots: spec.slots ?? ['primary'],
    structural: spec.structural ?? false,
    ...(spec.wheel ? { wheel: spec.wheel } : {}),
    ...(spec.aero ? { aero: spec.aero } : {}),
  }
}

const bricks: PartDefinition[] = ([[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4], [2, 6]] as const).map(([w, d]) =>
  define({ id: `brick_${w}x${d}`, label: `Brick ${w}×${d}`, category: 'bricks', size: [w, 3, d], shape: 'box' }))

const plates: PartDefinition[] = ([[1, 2], [1, 4], [2, 2], [2, 4], [2, 6], [4, 6]] as const).map(([w, d]) =>
  define({ id: `plate_${w}x${d}`, label: `Plate ${w}×${d}`, category: 'plates', size: [w, 1, d], shape: 'box' }))

const beams: PartDefinition[] = ([4, 6, 8, 12] as const).map(n =>
  define({ id: `beam_1x${n}`, label: `Beam ${n}`, category: 'beams', size: [1, 2, n], shape: 'beam', density: 0.9 }))

/** Studs on the high (rear, +Z) row only. */
const rearRow = (sx: number, sz: number): Cell[] => Array.from({ length: sx }, (_, x) => [x, sz - 1] as const)
/** Studs on the rear half. */
const rearHalf = (sx: number, sz: number): Cell[] => allCells(sx, sz).filter(([, z]) => z >= sz / 2)

const shaped: PartDefinition[] = [
  define({ id: 'slope_short', label: 'Slope short', category: 'shaped', size: [2, 3, 2], shape: 'slope', topStuds: rearRow(2, 2), fill: 0.65 }),
  define({ id: 'slope_long', label: 'Slope long', category: 'shaped', size: [2, 3, 4], shape: 'slope', topStuds: rearRow(2, 4), fill: 0.6 }),
  define({ id: 'wedge_left', label: 'Wedge left', category: 'shaped', size: [2, 3, 4], shape: 'wedge_left', topStuds: rearHalf(2, 4), fill: 0.55, mirror: 'wedge_right' }),
  define({ id: 'wedge_right', label: 'Wedge right', category: 'shaped', size: [2, 3, 4], shape: 'wedge_right', topStuds: rearHalf(2, 4), fill: 0.55, mirror: 'wedge_left' }),
  define({ id: 'curve_short', label: 'Curve short', category: 'shaped', size: [2, 3, 2], shape: 'curve', topStuds: rearRow(2, 2), fill: 0.7 }),
  define({ id: 'curve_long', label: 'Curve long', category: 'shaped', size: [2, 3, 4], shape: 'curve', topStuds: rearRow(2, 4), fill: 0.65 }),
]

/** Wheel axle sockets sit 2 plates above the bottom of a mount or axle beam. */
export const AXLE_HEIGHT_PLATES = 2

function axleConnector(id: string, x2: number, z2: number, dirX: -1 | 1): ConnectorDefinition {
  return {
    id,
    type: 'axle',
    pos2: [x2, AXLE_HEIGHT_PLATES * 2, z2],
    dir: [dirX, 0, 0],
    tags: ['wheel'],
    wheelMountRole: 'mount',
  }
}

const fittings: PartDefinition[] = [
  define({ id: 'chassis_short', label: 'Chassis short', category: 'fittings', size: [6, 2, 14], shape: 'chassis', density: 1.25, structural: true }),
  define({ id: 'chassis_long', label: 'Chassis long', category: 'fittings', size: [6, 2, 22], shape: 'chassis', density: 1.25, structural: true }),
  define({
    id: 'wheel_mount',
    label: 'Wheel mount',
    category: 'fittings',
    size: [2, 3, 2],
    shape: 'mount',
    density: 1.4,
    structural: true,
    extra: [axleConnector('ax_neg', 0, 2, -1), axleConnector('ax_pos', 4, 2, 1)],
  }),
  define({
    id: 'axle_beam',
    label: 'Axle beam',
    category: 'fittings',
    size: [8, 3, 2],
    shape: 'axle',
    density: 1.2,
    structural: true,
    extra: [axleConnector('ax_neg', 0, 2, -1), axleConnector('ax_pos', 16, 2, 1)],
  }),
]

/** Wheel bounding sizes are rounded up to even lattice values so hubs line up with mount axles. */
function wheel(id: string, label: string, tyre: TyreId, radiusM: number, widthStuds: number, massKg: number): PartDefinition {
  const diameterPlates = Math.ceil((radiusM * 2) / UNITS.plateM)
  const sy = diameterPlates % 2 === 0 ? diameterPlates : diameterPlates + 1
  const diameterStuds = Math.ceil((radiusM * 2) / UNITS.studM)
  const sz = diameterStuds % 2 === 0 ? diameterStuds : diameterStuds + 1
  const cy = sy / 2
  const cz = sz / 2
  const def = define({
    id,
    label,
    category: 'wheels',
    size: [widthStuds, sy, sz],
    shape: 'wheel',
    // Only a hub core is structural. The tyre sweep is validated separately as a warning.
    boxes: [box([0, cy - 2, cz - 1], [1, cy + 2, cz + 1])],
    topStuds: 'none',
    bottomSockets: 'none',
    massKg,
    slots: ['primary', 'tyre'],
    wheel: { tyre, radiusM, widthM: widthStuds * UNITS.studM, massKg },
    extra: [{ id: 'hub', type: 'hub', pos2: [0, sy, sz], dir: [-1, 0, 0], tags: ['wheel'] }],
  })
  return def
}

const wheels: PartDefinition[] = [
  wheel('wheel_small', 'Small wheel', 'small', 0.07, 2, 0.18),
  wheel('wheel_road', 'Road wheel', 'road', 0.1, 2, 0.3),
  wheel('wheel_wide', 'Wide wheel', 'wide', 0.1, 3, 0.4),
  wheel('wheel_offroad', 'Off-road wheel', 'offroad', 0.14, 3, 0.55),
]

const details: PartDefinition[] = [
  define({
    id: 'spoiler',
    label: 'Spoiler',
    category: 'details',
    size: [6, 5, 2],
    shape: 'wing',
    boxes: [box([1, 0, 0], [2, 3, 1]), box([4, 0, 0], [5, 3, 1]), box([0, 3, 0], [6, 5, 2])],
    topStuds: allCells(6, 2),
    bottomSockets: [[1, 0], [4, 0]],
    density: 0.8,
    aero: { wing: { areaM2: 6 * 2 * UNITS.studM * UNITS.studM, centre: [3, 4, 1] } },
  }),
  define({ id: 'bumper', label: 'Bumper', category: 'details', size: [6, 2, 1], shape: 'bumper', density: 0.9 }),
  define({ id: 'cockpit', label: 'Cockpit', category: 'details', size: [4, 6, 4], shape: 'cockpit', topStuds: 'none', fill: 0.25, slots: ['primary', 'glass'] }),
  define({ id: 'ballast', label: 'Ballast', category: 'details', size: [2, 3, 2], shape: 'ballast', density: 10 }),
]

export const PART_DEFINITIONS: readonly PartDefinition[] = [
  ...bricks,
  ...plates,
  ...beams,
  ...shaped,
  ...fittings,
  ...wheels,
  ...details,
]

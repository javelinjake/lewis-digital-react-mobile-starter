/**
 * The single place where editor lattice units become physics units.
 *
 * Editor geometry is a discrete lattice: X and Z in studs, Y in plates
 * (one brick = three plates). A stud pitch is 8 mm on a real brick, so the game
 * uses an enlarged toy scale: one stud is 0.05 m (6.25x real). A plate is 0.4 stud.
 * Physics, camera and displayed speeds all use these metres (game metres), so a
 * 2.6 m/s run is 2.6 game-metres per second. There is no hidden conversion to
 * full-size vehicle speed.
 */
import type { V3 } from './math'

export const UNITS = {
  /** Metres per stud (X and Z lattice step). */
  studM: 0.05,
  /** Metres per plate (Y lattice step). One stud is 2.5 plates. */
  plateM: 0.02,
  /** Plates per brick. */
  brickPlates: 3,
  /** Real brick stud pitch in metres, kept for the toy-scale note above. */
  realStudM: 0.008,
} as const

/** Lattice position (studs, plates, studs) to metres. */
export const latticeToMetres = (p: V3): V3 => [p[0] * UNITS.studM, p[1] * UNITS.plateM, p[2] * UNITS.studM]

/** Metres to lattice position (fractional). */
export const metresToLattice = (p: V3): V3 => [p[0] / UNITS.studM, p[1] / UNITS.plateM, p[2] / UNITS.studM]

/** Lattice size to metres. */
export const latticeSizeToMetres = latticeToMetres

/** Volume of one lattice cell (1 stud x 1 stud x 1 plate) in cubic metres. */
export const CELL_VOLUME_M3 = UNITS.studM * UNITS.studM * UNITS.plateM

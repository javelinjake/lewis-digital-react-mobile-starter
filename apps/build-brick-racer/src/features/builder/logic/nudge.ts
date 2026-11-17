/** Grouped move pad maths. Directions are relative to the screen so the arrows always feel right. */
export type LatticeStep = [number, number, number]
export type PadDirection = 'left' | 'right' | 'away' | 'toward' | 'up' | 'down'

/**
 * Lattice step for a pad button given the camera yaw. Camera sits at (sin yaw, cos yaw) from the target,
 * so screen-right is (cos yaw, -sin yaw) and "away" (up the screen on the floor) is (-sin yaw, -cos yaw).
 * Each is snapped to the dominant lattice axis. Vertical steps are one plate.
 */
export function padStep(direction: PadDirection, yaw: number, amount = 1): LatticeStep {
  if (direction === 'up')
    return [0, amount, 0]
  if (direction === 'down')
    return [0, -amount, 0]
  const right: [number, number] = [Math.cos(yaw), -Math.sin(yaw)]
  const away: [number, number] = [-Math.sin(yaw), -Math.cos(yaw)]
  const vec = direction === 'right' ? right : direction === 'left' ? [-right[0], -right[1]] : direction === 'away' ? away : [-away[0], -away[1]]
  return Math.abs(vec[0]) >= Math.abs(vec[1])
    ? [Math.sign(vec[0]) * amount, 0, 0]
    : [0, 0, Math.sign(vec[1]) * amount]
}

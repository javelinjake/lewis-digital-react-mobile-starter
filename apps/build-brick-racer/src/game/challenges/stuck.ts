import type { DriveInput } from '../vehicle/input'
import type { VehicleState } from '../vehicle/sim'

/** Seconds the car may be flipped or stuck before the large reset prompt is offered. */
export const RESET_PROMPT_SECONDS = 3

/** Detects "upside down or unable to progress despite input". Shared by challenge runs and free drive. */
export class StuckMonitor {
  private flipped = 0
  private stuck = 0

  get suggested(): boolean {
    return this.flipped >= RESET_PROMPT_SECONDS || this.stuck >= RESET_PROMPT_SECONDS
  }

  reset(): void {
    this.flipped = 0
    this.stuck = 0
  }

  update(state: VehicleState, input: DriveInput, wantsToMove: boolean, dt: number): void {
    this.flipped = state.upDot < 0.25 ? this.flipped + dt : 0
    this.stuck = Math.abs(state.forwardSpeed) < 0.12 && (wantsToMove || input.throttle > 0.3) ? this.stuck + dt : 0
  }
}

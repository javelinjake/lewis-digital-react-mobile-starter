import type { RawControls } from '@/game/vehicle/input'

/** The few fields we read from a standard-mapping gamepad. */
export interface PadLike {
  axes: ReadonlyArray<number>
  buttons: ReadonlyArray<{ pressed: boolean, value: number }>
}

const DEAD_ZONE = 0.16

/**
 * Standard mapping: left stick X steers, right trigger (7) throttle, left trigger (6) brake, X (2) reverse.
 * A (0) resets and Start (9) pauses; those two are edge-triggered in `GamepadPoller`.
 */
export function padToRaw(pad: PadLike): Partial<RawControls> {
  const x = pad.axes[0] ?? 0
  const steer = Math.abs(x) < DEAD_ZONE ? 0 : Math.sign(x) * ((Math.abs(x) - DEAD_ZONE) / (1 - DEAD_ZONE))
  return {
    steerAxis: steer,
    throttleAxis: pad.buttons[7]?.value ?? 0,
    brakeAxis: pad.buttons[6]?.value ?? 0,
    reverse: pad.buttons[2]?.pressed ?? false,
  }
}

export class GamepadPoller {
  private wasReset = false
  private wasPause = false

  constructor(private readonly actions: { reset: () => void, pause: () => void }) {}

  /** Poll once per frame. Returns analogue controls, or null if no pad is connected. */
  poll(pads: ReadonlyArray<PadLike | null> = typeof navigator !== 'undefined' && navigator.getGamepads ? (navigator.getGamepads() as unknown as Array<PadLike | null>) : []): Partial<RawControls> | null {
    const pad = pads.find(Boolean)
    if (!pad)
      return null
    const reset = pad.buttons[0]?.pressed ?? false
    const pause = pad.buttons[9]?.pressed ?? false
    if (reset && !this.wasReset)
      this.actions.reset()
    if (pause && !this.wasPause)
      this.actions.pause()
    this.wasReset = reset
    this.wasPause = pause
    return padToRaw(pad)
  }

  releaseAll(): void {
    this.wasReset = false
    this.wasPause = false
  }
}

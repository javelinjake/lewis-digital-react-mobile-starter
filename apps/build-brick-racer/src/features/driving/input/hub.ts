import type { KeyActions } from './keyboard'
import type { RawControls } from '@/game/vehicle/input'
import { emptyControls } from '@/game/vehicle/input'
import { GamepadPoller } from './gamepad'
import { KeyboardInput } from './keyboard'
import { TouchControls } from './touch-controls'

/**
 * Merges every player input source into one `RawControls`. Nothing here ever creates driving commands on its
 * own: with no finger, key or stick engaged, the result is all-neutral.
 */
export class ControlHub {
  readonly touch = new TouchControls()
  readonly keyboard: KeyboardInput
  readonly gamepad: GamepadPoller
  private pad: Partial<RawControls> | null = null

  constructor(actions: KeyActions) {
    this.keyboard = new KeyboardInput(actions)
    this.gamepad = new GamepadPoller({ reset: actions.reset, pause: actions.pause })
  }

  attach(): void {
    this.keyboard.attach()
  }

  detach(): void {
    this.keyboard.detach()
    this.releaseAll()
  }

  /** Called once per rendered frame to read analogue sticks and fire pad buttons. */
  poll(): void {
    this.pad = this.gamepad.poll()
  }

  read(): RawControls {
    const k = this.keyboard.toRaw()
    const t = this.touch.toRaw()
    const p = this.pad
    const raw = emptyControls()
    raw.left = Boolean(k.left || t.left)
    raw.right = Boolean(k.right || t.right)
    raw.throttle = Boolean(k.throttle || t.throttle)
    raw.brake = Boolean(k.brake || t.brake)
    raw.reverse = Boolean(k.reverse || t.reverse || p?.reverse)
    if (p) {
      raw.steerAxis = p.steerAxis ?? 0
      raw.throttleAxis = p.throttleAxis ?? 0
      raw.brakeAxis = p.brakeAxis ?? 0
    }
    return raw
  }

  /** Focus loss, pause, restart and unmount: every held input is cleared. */
  releaseAll(): void {
    this.touch.releaseAll()
    this.keyboard.releaseAll()
    this.gamepad.releaseAll()
    this.pad = null
  }
}

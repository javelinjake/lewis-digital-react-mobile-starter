import type { RawControls } from '@/game/vehicle/input'

/**
 * Keyboard bindings for testing and accessibility. Shown on the Pause screen.
 * Arrows or WASD to steer and drive, Space to brake, Shift to reverse.
 */
export const KEY_HELP: ReadonlyArray<{ keys: string, action: string }> = [
  { keys: '← → / A D', action: 'Steer' },
  { keys: '↑ / W', action: 'Throttle' },
  { keys: '↓ / S / Space', action: 'Brake' },
  { keys: 'Shift', action: 'Reverse (hold)' },
  { keys: 'R', action: 'Reset' },
  { keys: 'C', action: 'Change camera' },
  { keys: 'L', action: 'Lock camera' },
  { keys: 'P / Esc', action: 'Pause' },
]

const has = (keys: ReadonlySet<string>, ...codes: string[]) => codes.some(c => keys.has(c))

export function keysToRaw(keys: ReadonlySet<string>): Partial<RawControls> {
  const left = has(keys, 'ArrowLeft', 'KeyA')
  const right = has(keys, 'ArrowRight', 'KeyD')
  return {
    left: left && !right,
    right: right && !left,
    throttle: has(keys, 'ArrowUp', 'KeyW'),
    brake: has(keys, 'ArrowDown', 'KeyS', 'Space'),
    reverse: has(keys, 'ShiftLeft', 'ShiftRight'),
  }
}

export interface KeyActions {
  reset: () => void
  camera: () => void
  lock: () => void
  pause: () => void
}

const DRIVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight'])

/** Window keyboard listener that tracks held keys and reports one-shot actions. */
export class KeyboardInput {
  private readonly held = new Set<string>()
  private readonly down = (e: KeyboardEvent) => {
    if (e.repeat)
      return
    if (DRIVING_KEYS.has(e.code))
      e.preventDefault()
    this.held.add(e.code)
    if (e.code === 'KeyR')
      this.actions.reset()
    else if (e.code === 'KeyC')
      this.actions.camera()
    else if (e.code === 'KeyL')
      this.actions.lock()
    else if (e.code === 'KeyP' || e.code === 'Escape')
      this.actions.pause()
  }

  private readonly up = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  constructor(private readonly actions: KeyActions) {}

  attach(): void {
    window.addEventListener('keydown', this.down)
    window.addEventListener('keyup', this.up)
  }

  detach(): void {
    window.removeEventListener('keydown', this.down)
    window.removeEventListener('keyup', this.up)
    this.held.clear()
  }

  releaseAll(): void {
    this.held.clear()
  }

  toRaw(): Partial<RawControls> {
    return keysToRaw(this.held)
  }
}

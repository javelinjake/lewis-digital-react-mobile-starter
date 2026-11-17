import type { RawControls } from '@/game/vehicle/input'

export type PadId = 'left' | 'right' | 'throttle' | 'brake' | 'reverse'

/**
 * Independent touch ownership. Each on-screen control is owned by the pointer that pressed it, so steering,
 * throttle and brake can be held by different fingers at once. A pointer that lifts, is cancelled or loses
 * capture releases only its own control; `releaseAll` (focus loss, pause, unmount) releases everything.
 * Reverse is a deliberate latching control: tap to switch between forward and reverse.
 */
export class TouchControls {
  private readonly owners = new Map<PadId, number>()
  private readonly listeners = new Set<(pad: PadId, down: boolean) => void>()
  private reverseOn = false

  get reverse(): boolean {
    return this.reverseOn
  }

  onChange(fn: (pad: PadId, down: boolean) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(pad: PadId, down: boolean) {
    this.listeners.forEach(fn => fn(pad, down))
  }

  press(pad: PadId, pointerId: number): void {
    if (pad === 'reverse') {
      this.reverseOn = !this.reverseOn
      this.emit('reverse', this.reverseOn)
      return
    }
    this.owners.set(pad, pointerId)
    this.emit(pad, true)
  }

  /** Release whichever control this pointer owns. */
  release(pointerId: number): PadId | null {
    for (const [pad, owner] of this.owners) {
      if (owner === pointerId) {
        this.owners.delete(pad)
        this.emit(pad, false)
        return pad
      }
    }
    return null
  }

  releaseAll(): void {
    for (const pad of [...this.owners.keys()]) {
      this.owners.delete(pad)
      this.emit(pad, false)
    }
    if (this.reverseOn) {
      this.reverseOn = false
      this.emit('reverse', false)
    }
  }

  isDown(pad: PadId): boolean {
    return pad === 'reverse' ? this.reverseOn : this.owners.has(pad)
  }

  toRaw(): Partial<RawControls> {
    const left = this.owners.has('left')
    const right = this.owners.has('right')
    return {
      // Both steering buttons held cancel out.
      left: left && !right,
      right: right && !left,
      throttle: this.owners.has('throttle'),
      brake: this.owners.has('brake'),
      reverse: this.reverseOn,
    }
  }
}

/** Which side of the screen holds steering and pedals. Left-handed mirrors the default. */
export function layoutFor(leftHanded: boolean): { steer: 'left' | 'right', pedals: 'left' | 'right' } {
  return leftHanded ? { steer: 'right', pedals: 'left' } : { steer: 'left', pedals: 'right' }
}

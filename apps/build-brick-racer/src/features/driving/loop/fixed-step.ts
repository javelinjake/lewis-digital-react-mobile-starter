/**
 * Fixed-timestep accumulator. Physics always advances in equal ticks regardless of the render frame rate, so a
 * car behaves the same at 30, 60 or 144 fps. The leftover fraction is used to interpolate visuals.
 */
export class FixedStepper {
  private acc = 0

  constructor(readonly dt: number, readonly maxStepsPerFrame = 5, readonly maxFrame = 0.1) {}

  /** Advance by a render frame. Runs `step` for each whole tick that fits. Returns how many ticks ran. */
  advance(frameSeconds: number, step: () => void): number {
    this.acc += Math.min(Math.max(frameSeconds, 0), this.maxFrame)
    let steps = 0
    while (this.acc >= this.dt && steps < this.maxStepsPerFrame) {
      step()
      this.acc -= this.dt
      steps += 1
    }
    // If we fell behind by more than the cap, drop the backlog instead of spiralling.
    if (steps === this.maxStepsPerFrame && this.acc > this.dt)
      this.acc = this.acc % this.dt
    return steps
  }

  /** 0..1 progress between the last two ticks. */
  get alpha(): number {
    return this.acc / this.dt
  }

  reset(): void {
    this.acc = 0
  }
}

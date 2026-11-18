/**
 * Keeps the render-on-demand loop gentle: highlight pulses redraw at roughly 30 fps, and a device whose frames keep
 * arriving late is reported so the viewport can drop to the lighter render tier instead of starving touch input.
 */
export class FramePacer {
  private dirty = true
  private lastFrame = 0
  private lastDraw = 0
  private slow = 0

  /** Something changed, so the next frame must draw. */
  mark(): void {
    this.dirty = true
  }

  /** Decide whether this animation frame draws. Also tracks how late frames arrive. */
  shouldDraw(now: number, tweening: boolean): boolean {
    const dt = this.lastFrame ? now - this.lastFrame : 0
    this.lastFrame = now
    if (dt > 0)
      this.slow = dt > 70 ? this.slow + 1 : Math.max(0, this.slow - 1)
    if (!this.dirty && !tweening && now - this.lastDraw < 32)
      return false
    this.dirty = false
    this.lastDraw = now
    return true
  }

  /** The loop went idle, so the next frame is not "late" just because time passed. */
  idle(): void {
    this.lastFrame = 0
    this.slow = 0
  }

  get lagging(): boolean {
    return this.slow >= 6
  }
}

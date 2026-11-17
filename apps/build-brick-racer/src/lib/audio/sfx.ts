import { getGraph } from './context'

/** Short procedural effects. All are no-ops until audio has been unlocked by a user gesture. */
function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
  const g = getGraph()
  if (!g)
    return
  const t0 = g.ctx.currentTime + when
  const osc = g.ctx.createOscillator()
  const amp = g.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo)
    osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp).connect(g.effects)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noiseBurst(dur: number, gain: number, freq: number, q: number, when = 0, sweepTo?: number) {
  const g = getGraph()
  if (!g)
    return
  const t0 = g.ctx.currentTime + when
  const src = g.ctx.createBufferSource()
  src.buffer = g.noise
  const filter = g.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(freq, t0)
  if (sweepTo)
    filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur)
  filter.Q.value = q
  const amp = g.ctx.createGain()
  amp.gain.setValueAtTime(gain, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(amp).connect(g.effects)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}

export const sfx = {
  tap: () => tone(880, 0.05, 'sine', 0.25),
  /** The clear placement click in the builder. */
  snap: () => {
    noiseBurst(0.04, 0.5, 2400, 1.2)
    tone(520, 0.07, 'triangle', 0.3, 0, 300)
  },
  error: () => {
    tone(300, 0.12, 'square', 0.18)
    tone(210, 0.16, 'square', 0.18, 0.1)
  },
  thud: (intensity = 0.5) => {
    const k = Math.max(0.15, Math.min(1, intensity))
    tone(110, 0.18, 'sine', 0.55 * k, 0, 45)
    noiseBurst(0.12, 0.4 * k, 500, 0.8)
  },
  splash: () => noiseBurst(0.35, 0.4, 900, 0.7, 0, 2600),
  gate: () => {
    tone(1040, 0.08, 'sine', 0.2)
    tone(1560, 0.1, 'sine', 0.16, 0.06)
  },
  /** n = 3, 2, 1 for the beeps; 0 for Go. */
  countdown: (n: number) => (n > 0 ? tone(440, 0.14, 'square', 0.18) : tone(880, 0.35, 'square', 0.2)),
  finish: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.28, i * 0.1))
  },
}

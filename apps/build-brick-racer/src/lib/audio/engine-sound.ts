import { getGraph } from './context'
import { enginePitch, engineLevel, slideLevel } from './volumes'

/** Continuous engine hum and tyre noise for the car being driven. */
interface Voice {
  osc: OscillatorNode
  sub: OscillatorNode
  hum: GainNode
  noise: AudioBufferSourceNode
  hiss: GainNode
}

let voice: Voice | null = null

export const engine = {
  start(): void {
    const g = getGraph()
    if (!g || voice)
      return
    const osc = g.ctx.createOscillator()
    osc.type = 'sawtooth'
    const sub = g.ctx.createOscillator()
    sub.type = 'square'
    const lp = g.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    const hum = g.ctx.createGain()
    hum.gain.value = 0
    osc.connect(lp)
    sub.connect(lp)
    lp.connect(hum).connect(g.effects)
    const noise = g.ctx.createBufferSource()
    noise.buffer = g.noise
    noise.loop = true
    const bp = g.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.6
    const hiss = g.ctx.createGain()
    hiss.gain.value = 0
    noise.connect(bp).connect(hiss).connect(g.effects)
    osc.start()
    sub.start()
    noise.start()
    voice = { osc, sub, hum, noise, hiss }
  },

  update(speed: number, throttle: number, sliding: boolean): void {
    const g = getGraph()
    if (!g || !voice)
      return
    const t = g.ctx.currentTime
    const f = enginePitch(speed, throttle)
    voice.osc.frequency.setTargetAtTime(f, t, 0.06)
    voice.sub.frequency.setTargetAtTime(f / 2, t, 0.06)
    voice.hum.gain.setTargetAtTime(engineLevel(speed, throttle), t, 0.08)
    voice.hiss.gain.setTargetAtTime(slideLevel(sliding, speed), t, 0.05)
  },

  stop(): void {
    const g = getGraph()
    if (!g || !voice)
      return
    const v = voice
    voice = null
    const t = g.ctx.currentTime
    v.hum.gain.setTargetAtTime(0, t, 0.05)
    v.hiss.gain.setTargetAtTime(0, t, 0.05)
    setTimeout(() => {
      try {
        v.osc.stop()
        v.sub.stop()
        v.noise.stop()
      }
      catch {
        // Already stopped.
      }
    }, 300)
  },
}

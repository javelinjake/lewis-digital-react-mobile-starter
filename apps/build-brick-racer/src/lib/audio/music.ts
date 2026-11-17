import { getGraph } from './context'

/** A quiet procedural loop: a pentatonic arpeggio over a soft bass, scheduled just ahead of the audio clock. */
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]
const ROOT = 196
const STEP = 0.24
const BASS = [0, 0, -5, -5, -7, -7, -5, -5]

let timer: ReturnType<typeof setInterval> | null = null
let nextTime = 0
let step = 0

function schedule() {
  const g = getGraph()
  if (!g)
    return
  while (nextTime < g.ctx.currentTime + 0.5) {
    const i = step % 16
    const bar = Math.floor(step / 16) % BASS.length
    const note = SCALE[(i * 3 + bar) % SCALE.length]!
    const play = (semi: number, dur: number, type: OscillatorType, gain: number) => {
      const osc = g.ctx.createOscillator()
      const amp = g.ctx.createGain()
      osc.type = type
      osc.frequency.value = ROOT * 2 ** (semi / 12)
      amp.gain.setValueAtTime(0.0001, nextTime)
      amp.gain.exponentialRampToValueAtTime(gain, nextTime + 0.02)
      amp.gain.exponentialRampToValueAtTime(0.0001, nextTime + dur)
      osc.connect(amp).connect(g.music)
      osc.start(nextTime)
      osc.stop(nextTime + dur + 0.05)
    }
    if (i % 2 === 0)
      play(note + 12, STEP * 1.6, 'triangle', 0.22)
    if (i % 8 === 0)
      play(BASS[bar]! - 12, STEP * 6, 'sine', 0.35)
    nextTime += STEP
    step += 1
  }
}

export const music = {
  start(): void {
    const g = getGraph()
    if (!g || timer)
      return
    nextTime = g.ctx.currentTime + 0.1
    step = 0
    timer = setInterval(schedule, 120)
    schedule()
  },
  stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  },
  get playing(): boolean {
    return timer !== null
  },
}

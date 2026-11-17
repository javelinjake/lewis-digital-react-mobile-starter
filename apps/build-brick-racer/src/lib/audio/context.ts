import type { AudioPrefs } from './volumes'
import { busGains } from './volumes'

/**
 * Lazily created WebAudio graph. Nothing is created until `audio.unlock()` runs inside a user gesture, which is
 * the only moment browsers let audio start. Everything is synthesised, so there are no asset downloads.
 */
interface Graph {
  ctx: AudioContext
  effects: GainNode
  music: GainNode
  noise: AudioBuffer
}

let graph: Graph | null = null
let prefs: AudioPrefs = { music: 0.5, effects: 0.7, muted: false }

function applyGains() {
  if (!graph)
    return
  const g = busGains(prefs)
  const t = graph.ctx.currentTime
  graph.effects.gain.setTargetAtTime(g.effects, t, 0.03)
  graph.music.gain.setTargetAtTime(g.music, t, 0.05)
}

function createNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

export const audio = {
  /** Call from a pointer or key handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === 'undefined')
      return
    if (!graph) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor)
        return
      try {
        const ctx = new Ctor()
        const effects = ctx.createGain()
        const music = ctx.createGain()
        effects.connect(ctx.destination)
        music.connect(ctx.destination)
        graph = { ctx, effects, music, noise: createNoise(ctx) }
        applyGains()
      }
      catch {
        graph = null
        return
      }
    }
    if (graph.ctx.state === 'suspended')
      void graph.ctx.resume().catch(() => {})
  },

  /** Apply volume and mute preferences. Works before and after unlock. */
  apply(next: AudioPrefs): void {
    prefs = next
    applyGains()
  },

  get unlocked(): boolean {
    return graph !== null && graph.ctx.state === 'running'
  },

  /** Suspend everything while the app is hidden. */
  suspend(): void {
    if (graph?.ctx.state === 'running')
      void graph.ctx.suspend().catch(() => {})
  },
}

export function getGraph(): Graph | null {
  return graph
}

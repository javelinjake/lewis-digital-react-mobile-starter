/** Pure audio mapping so volume, mute and engine pitch behaviour can be tested without a browser audio stack. */
export interface AudioPrefs {
  music: number
  effects: number
  muted: boolean
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))

/** Perceptual (squared) curve so the slider feels even. Muted silences both buses. */
export function busGains(p: AudioPrefs): { effects: number, music: number } {
  if (p.muted)
    return { effects: 0, music: 0 }
  return { effects: clamp01(p.effects) ** 2 * 0.9, music: clamp01(p.music) ** 2 * 0.35 }
}

/** Engine hum frequency in Hz from speed (m/s) and throttle 0..1. */
export function enginePitch(speed: number, throttle: number): number {
  return 62 + Math.min(speed, 8) * 17 + clamp01(throttle) * 22
}

/** Engine loudness 0..1: a quiet idle that swells with speed and throttle. */
export function engineLevel(speed: number, throttle: number): number {
  return 0.05 + clamp01(speed / 6) * 0.14 + clamp01(throttle) * 0.1
}

/** Tyre noise level when sliding or spinning. */
export function slideLevel(sliding: boolean, speed: number): number {
  return sliding ? clamp01(speed / 4) * 0.22 : 0
}

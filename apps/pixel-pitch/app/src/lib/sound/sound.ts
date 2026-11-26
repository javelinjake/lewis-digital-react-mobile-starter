// Sound effects. Web Audio, so a sound plays at once and several can overlap; each file is fetched and decoded the
// first time it is wanted, then kept. Nothing plays until the player has touched the screen (the browser's rule), and
// nothing plays while sound is off in Settings (kept on this device).

const files = import.meta.glob('/src/assets/game/audio/*.m4a', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type Sound
  = | 'tap' | 'back' | 'error' | 'collect' | 'coin' | 'sign' | 'sell' | 'swap' | 'upgrade' | 'score_up' | 'notification'
    | 'pack_rip' | 'card_flip' | 'reveal_common' | 'reveal_pro' | 'reveal_star' | 'reveal_legend'
    | 'kick' | 'perfect' | 'goal' | 'whistle_kickoff' | 'whistle_fulltime' | 'win' | 'draw' | 'loss' | 'promoted'

const KEY = 'pp-sound'
const listeners = new Set<() => void>()
let context: AudioContext | null = null
const buffers = new Map<Sound, Promise<AudioBuffer | null>>()

/** Whether sound is on (the default). */
export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  }
  catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  }
  catch {
    // Not saved; it still applies until the app closes.
  }
  for (const listener of listeners)
    listener()
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window))
    return null
  context ??= new AudioContext()
  return context
}

function load(sound: Sound): Promise<AudioBuffer | null> {
  let pending = buffers.get(sound)
  if (!pending) {
    const url = files[`/src/assets/game/audio/${sound}.m4a`]
    const ctx = audio()
    pending = url && ctx
      ? fetch(url).then(response => response.arrayBuffer()).then(data => ctx.decodeAudioData(data)).catch(() => null)
      : Promise.resolve(null)
    buffers.set(sound, pending)
  }
  return pending
}

/** Plays a sound effect, if sound is on. Never throws: a sound that cannot play is skipped. */
export function play(sound: Sound, volume = 1) {
  if (!soundOn())
    return
  const ctx = audio()
  if (!ctx)
    return
  if (ctx.state === 'suspended')
    void ctx.resume().catch(() => {})
  void load(sound).then((buffer) => {
    if (!buffer || !soundOn())
      return
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.buffer = buffer
    source.connect(gain).connect(ctx.destination)
    source.start()
  })
}

/** Fetches the sounds a screen is about to use, so the first one is not late. */
export function preload(...sounds: Sound[]) {
  if (soundOn())
    sounds.forEach(sound => void load(sound))
}

/**
 * A quiet tap on every button, in one place: a click on anything that looks like a button that has not asked for
 * its own sound (`data-sound="none"`). Returns the clean-up.
 */
export function installTapSound(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest('button, a.btn, [role="tab"], [role="switch"]') : null
    if (!target || target.closest('[data-sound="none"]') || (target as HTMLButtonElement).disabled)
      return
    play('tap', 0.5)
  }
  document.addEventListener('click', onClick, { capture: true })
  return () => document.removeEventListener('click', onClick, { capture: true })
}

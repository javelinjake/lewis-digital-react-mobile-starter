/**
 * Music and sound effects on two separate channels, each with its own on/off switch (a Settings requirement).
 * Browsers only allow audio after a tap, so `unlock()` must be called from the first user gesture.
 * Music is silenced while the app is in the background.
 */
export interface AudioSources {
  sfx: Readonly<Record<string, string>>
  music: Readonly<Record<string, string>>
}

export interface AudioManagerOptions {
  context?: AudioContext
  /** How a file becomes a buffer. Replaced in tests. */
  loadBuffer?: (context: AudioContext, url: string) => Promise<AudioBuffer>
  sfxVolume?: number
  musicVolume?: number
}

async function fetchBuffer(context: AudioContext, url: string) {
  const response = await fetch(url)
  return context.decodeAudioData(await response.arrayBuffer())
}

export function createAudioManager(sources: AudioSources, options: AudioManagerOptions = {}) {
  const context = options.context ?? new AudioContext()
  const load = options.loadBuffer ?? fetchBuffer
  const buffers = new Map<string, Promise<AudioBuffer>>()

  const sfxGain = context.createGain()
  const musicGain = context.createGain()
  sfxGain.connect(context.destination)
  musicGain.connect(context.destination)

  let sfxEnabled = true
  let musicEnabled = true
  let hidden = false
  let currentMusic: { name: string, source: AudioBufferSourceNode } | null = null

  const sfxLevel = options.sfxVolume ?? 0.8
  const musicLevel = options.musicVolume ?? 0.45

  function applyGains() {
    sfxGain.gain.value = sfxEnabled ? sfxLevel : 0
    musicGain.gain.value = musicEnabled && !hidden ? musicLevel : 0
  }
  applyGains()

  function buffer(kind: keyof AudioSources, name: string) {
    const url = sources[kind][name]
    if (!url)
      return Promise.reject(new Error(`No ${kind} sound named "${name}".`))
    const key = `${kind}:${name}`
    if (!buffers.has(key))
      buffers.set(key, load(context, url))
    return buffers.get(key)!
  }

  return {
    /** Call from the first tap or click. Safe to call again. */
    async unlock() {
      if (context.state === 'suspended')
        await context.resume()
    },

    /** Decode sounds ahead of time so the first rip does not stutter. */
    async preload(names: { sfx?: string[], music?: string[] } = {}) {
      await Promise.all([
        ...(names.sfx ?? Object.keys(sources.sfx)).map(name => buffer('sfx', name)),
        ...(names.music ?? []).map(name => buffer('music', name)),
      ])
    },

    async playSfx(name: string, volume = 1) {
      if (!sfxEnabled)
        return
      const source = context.createBufferSource()
      source.buffer = await buffer('sfx', name)
      const gain = context.createGain()
      gain.gain.value = volume
      source.connect(gain).connect(sfxGain)
      source.start()
    },

    async playMusic(name: string) {
      if (currentMusic?.name === name)
        return
      currentMusic?.source.stop()
      const source = context.createBufferSource()
      source.buffer = await buffer('music', name)
      source.loop = true
      source.connect(musicGain)
      source.start()
      currentMusic = { name, source }
    },

    stopMusic() {
      currentMusic?.source.stop()
      currentMusic = null
    },

    setSfxEnabled(enabled: boolean) {
      sfxEnabled = enabled
      applyGains()
    },

    setMusicEnabled(enabled: boolean) {
      musicEnabled = enabled
      applyGains()
    },

    /** True while the app is in the background: music goes quiet and comes back on return. */
    setHidden(value: boolean) {
      hidden = value
      applyGains()
    },

    get state() {
      return { sfxEnabled, musicEnabled, hidden, music: currentMusic?.name ?? null }
    },
  }
}

export type AudioManager = ReturnType<typeof createAudioManager>

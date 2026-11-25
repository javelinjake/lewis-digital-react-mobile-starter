import { NativeAudio } from '@capacitor-community/native-audio'
import { isNativePlatform } from './platform'

/** Needs `capabilities.audio` in app.meta.ts and `@capacitor-community/native-audio` in the app's package.json. */

export interface SoundOptions {
  /** 0 to 1. Default 1. */
  volume?: number
  /** Copies that can overlap, for a sound that fires faster than it plays (taps, coins). Default 1. */
  voices?: number
}

export interface SoundPlayer {
  /**
   * Loads a sound so the first play has no delay. `src` is a path under the app's `public/` folder, for example
   * `sounds/coin.mp3`, the same on every platform. Use one dot in the file name (iOS splits on it) and mp3 or m4a.
   * Loading the same id twice is a no-op.
   */
  load: (id: string, src: string, options?: SoundOptions) => Promise<void>
  play: (id: string) => Promise<void>
  /** Plays on repeat until `stop`. For music. */
  loop: (id: string) => Promise<void>
  stop: (id: string) => Promise<void>
  setVolume: (id: string, volume: number) => Promise<void>
  unload: (id: string) => Promise<void>
}

/**
 * Low-latency sound for games and feedback. On iOS and Android sounds play through the native audio engine,
 * which avoids the WebView's delay on the first play; on the web the plugin uses audio elements. Sound is a
 * nicety: every method swallows errors, so a missing file never breaks a screen. Respect the device's silent switch
 * by keeping effects short and letting the person mute them in settings.
 */
export function createSoundPlayer(): SoundPlayer {
  const loaded = new Set<string>()
  const quietly = async (work: () => Promise<unknown>) => {
    try {
      await work()
    }
    catch {
      // A sound that cannot play is not worth an error on screen.
    }
  }

  void quietly(() => NativeAudio.configure({ fade: false, focus: false }))

  return {
    load: (id, src, options = {}) => quietly(async () => {
      if (loaded.has(id))
        return
      const path = src.replace(/^\/+/, '')
      await NativeAudio.preload({
        assetId: id,
        // Native reads the file from the app bundle, where the web build sits under `public/`. The web plugin would
        // otherwise prefix `assets/sounds/`, so it gets the site path as a URL.
        assetPath: isNativePlatform() ? `public/${path}` : `/${path}`,
        isUrl: !isNativePlatform(),
        volume: options.volume ?? 1,
        audioChannelNum: options.voices ?? 1,
      })
      loaded.add(id)
    }),
    play: id => quietly(() => NativeAudio.play({ assetId: id })),
    loop: id => quietly(() => NativeAudio.loop({ assetId: id })),
    stop: id => quietly(() => NativeAudio.stop({ assetId: id })),
    setVolume: (id, volume) => quietly(() => NativeAudio.setVolume({ assetId: id, volume: Math.min(1, Math.max(0, volume)) })),
    unload: id => quietly(async () => {
      await NativeAudio.unload({ assetId: id })
      loaded.delete(id)
    }),
  }
}

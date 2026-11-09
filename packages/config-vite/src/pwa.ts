import type { PluginOption } from 'vite'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { VitePWA } from 'vite-plugin-pwa'

export interface PwaConfigOptions {
  name: string
  shortName: string
  description?: string
  themeColor?: string
  backgroundColor?: string
  devEnabled?: boolean
  /** `any` omits the lock so the manifest follows the device. */
  orientation?: 'portrait' | 'landscape' | 'any'
  iconSource?: string | false
  /**
   * The app's own icons, already in `public/`, for apps whose art must not be resampled (pixel art). Use with
   * `iconSource: false`. Listed in the manifest and precached with the shell.
   */
  icons?: ManifestOptions['icons']
}

/**
 * The service worker caches the app shell only. It never touches `/api`: responses there belong to one signed-in
 * user, and a cache keyed by URL is shared by everyone who uses the device (two users can both own
 * `/api/private-media/file/photo.png`). Offline data comes from the per-user IndexedDB cache in `@ld/react-utils`.
 */
export function createPwaPlugin(options: PwaConfigOptions): PluginOption {
  const {
    name,
    shortName,
    description = '',
    themeColor = '#ffffff',
    backgroundColor = themeColor,
    devEnabled = false,
    orientation = 'portrait',
    iconSource = 'public/pwa-icon.svg',
    icons,
  } = options

  return VitePWA({
    injectRegister: false,
    registerType: 'prompt',
    includeAssets: ['favicon.svg', ...(icons ?? []).map(icon => icon.src.replace(/^\//, ''))],
    manifest: {
      name,
      short_name: shortName,
      description,
      theme_color: themeColor,
      background_color: backgroundColor,
      display: 'standalone',
      ...(orientation === 'any' ? {} : { orientation }),
      start_url: '/',
      scope: '/',
      ...(icons ? { icons } : {}),
    },
    pwaAssets: iconSource === false
      ? { disabled: true }
      : { preset: 'minimal-2023', image: iconSource },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      navigateFallbackDenylist: [/^\/api\//],
      // Large lazy chunks load on demand instead of bloating the first install.
      maximumFileSizeToCacheInBytes: 600 * 1024,
      runtimeCaching: [],
    },
    devOptions: {
      enabled: devEnabled,
      type: 'module',
    },
  })
}

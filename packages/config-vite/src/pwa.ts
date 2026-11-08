import type { PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export interface PwaConfigOptions {
  name: string
  shortName: string
  description?: string
  themeColor?: string
  backgroundColor?: string
  devEnabled?: boolean
  iconSource?: string | false
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
    iconSource = 'public/pwa-icon.svg',
  } = options

  return VitePWA({
    injectRegister: false,
    registerType: 'prompt',
    includeAssets: ['favicon.svg'],
    manifest: {
      name,
      short_name: shortName,
      description,
      theme_color: themeColor,
      background_color: backgroundColor,
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
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

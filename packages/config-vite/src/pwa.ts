import type { PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export interface PwaConfigOptions {
  name: string
  shortName: string
  description?: string
  themeColor?: string
  backgroundColor?: string
  apiOrigins?: string[]
  devEnabled?: boolean
  iconSource?: string | false
}

const ONE_DAY = 60 * 60 * 24

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normaliseOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '')
}

const ANY_ORIGIN = 'https?://[^/]+'

function createApiRuntimeCaching(origins: string[]) {
  const bases = origins.map(normaliseOrigin).filter(Boolean).map(escapeRegExp)

  return (bases.length > 0 ? bases : [ANY_ORIGIN])
    .flatMap((base) => {
      return [
        {
          urlPattern: new RegExp(`^${base}/assets/`),
          handler: 'CacheFirst' as const,
          method: 'GET' as const,
          options: {
            cacheName: 'ld-api-assets',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * ONE_DAY },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: new RegExp(`^${base}/(items|users|files|fields|collections)/`),
          handler: 'NetworkFirst' as const,
          method: 'GET' as const,
          options: {
            cacheName: 'ld-api-data',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 300, maxAgeSeconds: 7 * ONE_DAY },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ]
    })
}

export function createPwaPlugin(options: PwaConfigOptions): PluginOption {
  const {
    name,
    shortName,
    description = '',
    themeColor = '#ffffff',
    backgroundColor = themeColor,
    apiOrigins = [],
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
      runtimeCaching: createApiRuntimeCaching(apiOrigins),
    },
    devOptions: {
      enabled: devEnabled,
      type: 'module',
    },
  })
}

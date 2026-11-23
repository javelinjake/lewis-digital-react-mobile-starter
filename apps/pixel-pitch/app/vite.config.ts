import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildAppLinkFiles } from '@ld/config-capacitor/app-links'
import { resolveIdentity } from '@ld/config-capacitor/identity'
import { createViteConfig } from '@ld/config-vite'
import { appMeta } from './app.meta'

const root = fileURLToPath(new URL('.', import.meta.url))
const buildTarget = process.env.VITE_BUILD_TARGET === 'native' ? 'native' : 'web'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default createViteConfig({
  root,
  buildTarget,
  version,
  // Only read for native builds, so APP_ENV picks the api address the same way it picks the bundle id.
  nativeApiUrl: buildTarget === 'native' ? resolveIdentity(appMeta, process.env.APP_ENV).apiUrl : undefined,
  // Universal Links and App Links files, once app.meta.ts has the Apple team id and Android fingerprints.
  appLinks: buildAppLinkFiles(appMeta),
  apiProxy: process.env.VITE_API_PROXY ?? 'http://localhost:3001',
  meta: { name: appMeta.name, description: appMeta.description, themeColor: appMeta.themeColor },
  pwa: buildTarget === 'web'
    ? {
        name: appMeta.name,
        shortName: appMeta.shortName,
        description: appMeta.description,
        themeColor: appMeta.themeColor,
        backgroundColor: appMeta.backgroundColor,
        devEnabled: process.env.VITE_PWA_DEV === 'true',
        orientation: appMeta.orientation,
        // Pixel art, so the icons are made by art:build (nearest-neighbour), not resampled by the PWA generator.
        iconSource: false,
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }
    : undefined,
})

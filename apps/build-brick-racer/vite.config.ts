import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@ld/config-vite'
import { appMeta } from './app.meta'

const root = fileURLToPath(new URL('.', import.meta.url))
const buildTarget = process.env.VITE_BUILD_TARGET === 'native' ? 'native' : 'web'

export default createViteConfig({
  root,
  buildTarget,
  pwa: buildTarget === 'web'
    ? {
        name: appMeta.name,
        shortName: appMeta.shortName,
        description: appMeta.description,
        themeColor: appMeta.themeColor,
        backgroundColor: appMeta.backgroundColor,
        orientation: appMeta.orientation,
        // Rapier's WASM (bundled inline) is about 4.3 MB; offline play needs it precached.
        maxPrecacheFileSizeBytes: 8 * 1024 * 1024,
        devEnabled: process.env.VITE_PWA_DEV === 'true',
        iconSource: false,
      }
    : undefined,
})

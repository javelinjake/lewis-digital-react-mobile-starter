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
        apiOrigins: process.env.VITE_DIRECTUS_URL ? [process.env.VITE_DIRECTUS_URL] : [],
        devEnabled: process.env.VITE_PWA_DEV === 'true',
        iconSource: false,
      }
    : undefined,
})

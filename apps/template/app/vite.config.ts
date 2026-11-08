import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@ld/config-vite'
import { appMeta } from './app.meta'

const root = fileURLToPath(new URL('.', import.meta.url))
const buildTarget = process.env.VITE_BUILD_TARGET === 'native' ? 'native' : 'web'

export default createViteConfig({
  root,
  buildTarget,
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
        iconSource: false,
      }
    : undefined,
})

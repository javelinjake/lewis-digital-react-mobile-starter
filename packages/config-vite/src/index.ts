import type { PwaConfigOptions } from './pwa.ts'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type PluginOption, type UserConfig } from 'vite'
import { createPwaPlugin } from './pwa.ts'

export type { PwaConfigOptions } from './pwa.ts'
export type BuildTarget = 'web' | 'native'

export interface CreateViteConfigOptions {
  root: string
  port?: number
  /** `native` omits the service worker. IndexedDB caching stays available either way. */
  buildTarget?: BuildTarget
  /** Enable the PWA service worker and manifest. Ignored for native builds. */
  pwa?: PwaConfigOptions
  /**
   * Where `/api` goes in `vite dev` and `vite preview`. The web app calls the backend on its own origin, so the
   * session cookie is first-party. On Vercel the same job is done by a rewrite in vercel.json.
   */
  apiProxy?: string
  /** Written into index.html, so the page has a description and a browser colour without a hand-kept copy. */
  meta?: { name: string, description: string, themeColor: string }
}

/**
 * A release build must talk to the real backend. `VITE_DATA_MODE=mock` is for development, tests and Lighthouse runs,
 * and needs `VITE_ALLOW_MOCK_BUILD=1` to build at all, so a mock app cannot be deployed by accident.
 */
function htmlMeta(meta: { name: string, description: string, themeColor: string }): Plugin {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return {
    name: 'ld-html-meta',
    transformIndexHtml: html => ({
      // A first paint that does not wait for JavaScript: the app's name, centred, where the app will appear.
      html: html.replace('<div id="root"></div>', `<div id="root"><main class="app-shell" aria-busy="true"><span>${escape(meta.name)}</span></main></div>`),
      tags: [
        { tag: 'meta', attrs: { name: 'description', content: escape(meta.description) }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: escape(meta.themeColor) }, injectTo: 'head' },
      ],
    }),
  }
}

function dataModeGuard(): Plugin {
  return {
    name: 'ld-data-mode-guard',
    configResolved(config) {
      if (config.command !== 'build')
        return
      const env = config.env as Record<string, string | undefined>
      if (env.VITE_DATA_MODE === 'live' || env.VITE_ALLOW_MOCK_BUILD === '1')
        return
      throw new Error('Production builds need VITE_DATA_MODE=live. For a mock-data build (tests, Lighthouse) also set VITE_ALLOW_MOCK_BUILD=1; never deploy it.')
    },
  }
}

export function createViteConfig(options: CreateViteConfigOptions): UserConfig {
  const { root, port = 5173, pwa, buildTarget = 'web', apiProxy, meta } = options
  const plugins: PluginOption[] = [react(), tailwindcss(), dataModeGuard(), ...(meta ? [htmlMeta(meta)] : [])]
  const proxy = apiProxy ? { '/api': { target: apiProxy, changeOrigin: true } } : undefined

  if (buildTarget !== 'native' && pwa)
    plugins.push(createPwaPlugin(pwa))

  return defineConfig({
    root,
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', `file://${root}/`)),
        ...(buildTarget === 'native'
          ? { 'virtual:pwa-register': fileURLToPath(new URL('../../pwa/src/register-stub.ts', import.meta.url)) }
          : {}),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Framework code changes rarely, app code often. Separate files mean a release re-downloads only the app,
          // and the framework stays in the browser (and service worker) cache.
          manualChunks(id) {
            if (!id.includes('node_modules'))
              return undefined
            if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom|scheduler)\//.test(id))
              return 'react'
            if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react-router|@remix-run)/.test(id))
              return 'router'
            if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@tanstack\//.test(id))
              return 'query'
            return undefined
          },
        },
      },
    },
    server: {
      port,
      host: true,
      ...(proxy ? { proxy } : {}),
    },
    preview: proxy ? { proxy } : undefined,
  })
}

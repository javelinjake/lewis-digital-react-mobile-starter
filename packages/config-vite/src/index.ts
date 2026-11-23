import type { PwaConfigOptions } from './pwa.ts'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type PluginOption, type UserConfig } from 'vite'
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
  /**
   * The api address for this `APP_ENV`, from `app.meta.ts` (`resolveIdentity(appMeta, APP_ENV).apiUrl`). A native
   * build uses it when `VITE_API_URL` is not set. Web builds ignore it.
   */
  nativeApiUrl?: string
  /** The app's `package.json` version, exposed as `import.meta.env.VITE_APP_VERSION`. */
  version?: string
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

/**
 * Build facts the app reads at runtime: the version and build number (for crash reports and live updates) and, for
 * native, the api address from `app.meta.ts` so it cannot drift from the environment being built. An explicit
 * `VITE_API_URL` still wins. A live native build with no api address at all fails here instead of on the phone.
 */
function buildInfo(root: string, buildTarget: BuildTarget, nativeApiUrl: string | undefined, version: string | undefined): Plugin {
  return {
    name: 'ld-build-info',
    config(_config, { mode, command }) {
      const env = loadEnv(mode, root, 'VITE_')
      const define: Record<string, string> = {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(version ?? '0.0.0'),
        // Only from the environment, so a cached build never carries a stale number. The release script sets it.
        'import.meta.env.VITE_APP_BUILD': JSON.stringify(process.env.BUILD_NUMBER?.trim() ?? ''),
      }

      if (buildTarget === 'native') {
        const apiUrl = env.VITE_API_URL?.trim() || nativeApiUrl?.trim() || ''
        define['import.meta.env.VITE_API_URL'] = JSON.stringify(apiUrl)
        if (command === 'build' && env.VITE_DATA_MODE === 'live' && !apiUrl) {
          throw new Error(`A live native build needs an api address. Set environments.${process.env.APP_ENV?.trim() || 'prod'}.apiUrl in app.meta.ts (APP_ENV picks the entry, default prod), or VITE_API_URL.`)
        }
      }

      return { define }
    },
  }
}

export function createViteConfig(options: CreateViteConfigOptions): UserConfig {
  const { root, port = 5173, pwa, buildTarget = 'web', apiProxy, meta, nativeApiUrl, version } = options
  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    dataModeGuard(),
    buildInfo(root, buildTarget, nativeApiUrl, version),
    ...(meta ? [htmlMeta(meta)] : []),
  ]
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

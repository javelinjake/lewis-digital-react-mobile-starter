import type { CapacitorConfig } from '@capacitor/cli'
import process from 'node:process'

export interface CreateCapacitorConfigOptions {
  /** Reverse-DNS bundle identifier, e.g. `uk.co.lewisdigital.acme`. */
  appId: string
  appName: string
  /** Vite build output. Defaults to `dist`. */
  webDir?: string
  /** Splash background colour, usually the theme's base-100. */
  backgroundColor?: string
  /**
   * Production hostname used for Android App Links and iOS Universal Links.
   * Also sets the WebView origin so cookies/CORS match the web app.
   */
  hostname?: string
}

/**
 * Shared Capacitor config. Live reload against the Vite dev server is enabled
 * only when `CAP_SERVER_URL` is set (see `pnpm cap:dev`).
 */
export function createCapacitorConfig(options: CreateCapacitorConfigOptions): CapacitorConfig {
  const {
    appId,
    appName,
    webDir = 'dist',
    backgroundColor = '#ffffff',
    hostname,
  } = options

  const liveReloadUrl = process.env.CAP_SERVER_URL?.trim()

  return {
    appId,
    appName,
    webDir,
    server: {
      androidScheme: 'https',
      ...(hostname ? { hostname } : {}),
      ...(liveReloadUrl ? { url: liveReloadUrl, cleartext: true } : {}),
    },
    ios: {
      // 'never' so the web view draws under the status bar and CSS env(safe-area-inset-*) applies
      contentInset: 'never',
      backgroundColor,
      preferredContentMode: 'mobile',
    },
    android: {
      backgroundColor,
      allowMixedContent: Boolean(liveReloadUrl),
    },
    plugins: {
      SplashScreen: {
        launchAutoHide: false,
        backgroundColor,
        showSpinner: false,
      },
      Keyboard: {
        resize: 'body',
        resizeOnFullScreen: true,
      },
      StatusBar: {
        overlaysWebView: true,
      },
      PushNotifications: {
        presentationOptions: ['badge', 'sound', 'alert'],
      },
    },
  }
}

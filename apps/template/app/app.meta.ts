/**
 * Single source of truth for identity shared by the web manifest, Capacitor
 * config and native project configuration.
 */
export const appMeta = {
  name: 'Lewis Digital App',
  shortName: 'LD App',
  description: 'Lewis Digital mobile app.',
  /** Reverse-DNS identifier used for the iOS bundle ID and Android application ID. */
  appId: 'uk.co.lewisdigital.template',
  /** Production web origin, used for Universal Links / App Links. Leave empty until known. */
  hostname: '',
  themeColor: '#ffffff',
  backgroundColor: '#ffffff',
  /**
   * Sign-in methods this app offers. The api (`payload.config.ts`) reads the same list, so the screens and the
   * server cannot disagree. Google needs Apple as well: the App Store requires it.
   */
  auth: {
    emailPassword: true,
    anonymous: true,
    apple: false,
    google: false,
  },
} as const

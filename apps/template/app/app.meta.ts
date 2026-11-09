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
  /** `portrait` locks the app and the PWA manifest. `any` follows the device. */
  orientation: 'any',
  /** False for a phone-only app: no tablet test project, and iPad runs it letterboxed. */
  tablet: true,
  /**
   * One entry per build environment (`APP_ENV=dev|staging|prod`). Each gets its own bundle id and name, so all three
   * install side by side. `apiUrl` is the backend that environment talks to. Leave an entry out to use the defaults
   * (`.dev` / `.staging` suffixes, no api address).
   */
  environments: {
    dev: { apiUrl: 'http://localhost:3001' },
    staging: { apiUrl: '' },
    prod: { apiUrl: '' },
  },
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

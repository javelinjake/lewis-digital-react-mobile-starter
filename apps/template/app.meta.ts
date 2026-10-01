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
} as const

/**
 * Single source of truth for identity shared by the web manifest, Capacitor
 * config and native project configuration.
 */
export const appMeta = {
  name: 'Zactiv Family',
  shortName: 'Zactiv',
  description: 'Move, cook, watch and chat as a family.',
  /** Reverse-DNS identifier used for the iOS bundle ID and Android application ID. */
  appId: 'uk.co.lewisdigital.zactivfamily',
  /** Production web origin, used for Universal Links / App Links. Leave empty until known. */
  hostname: '',
  themeColor: '#0000ff',
  backgroundColor: '#f6f1e7',
} as const

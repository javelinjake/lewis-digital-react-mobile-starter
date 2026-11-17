/**
 * Single source of truth for identity shared by the web manifest, Capacitor
 * config and native project configuration.
 */
export const appMeta = {
  name: 'Build Brick Racer',
  shortName: 'Brick Racer',
  description: 'Build a brick car, drive it around giant kitchens and gardens, then change it and drive again.',
  /** Reverse-DNS identifier used for the iOS bundle ID and Android application ID. */
  appId: 'uk.co.lewisdigital.buildbrickracer',
  /** Production web origin, used for Universal Links / App Links. Leave empty until known. */
  hostname: '',
  /** The game is landscape-first on phones and tablets. */
  orientation: 'landscape',
  themeColor: '#0b1f3a',
  backgroundColor: '#0b1f3a',
} as const

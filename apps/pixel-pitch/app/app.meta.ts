/**
 * Single source of truth for identity shared by the web manifest, Capacitor config, native project configuration and
 * the api app (which reads the sign-in methods from here).
 */
export const appMeta = {
  name: 'Pixel Pitch',
  shortName: 'Pixel Pitch',
  description: 'Pixel Pitch mobile app.',
  /** Reverse-DNS identifier used for the iOS bundle ID and Android application ID. */
  appId: 'uk.co.lewisdigital.pixelpitch',
  /** Production web origin, used for Universal Links / App Links. Fill in once the domain is known. */
  hostname: '',
  orientation: 'portrait',
  tablet: false,
  /** One entry per build environment (APP_ENV). Fill in each api address once it exists. */
  environments: {
    dev: { apiUrl: 'http://localhost:3001' },
    staging: { apiUrl: '' },
    prod: { apiUrl: '' },
  },
  themeColor: '#ffd23f',
  backgroundColor: '#1b1f3b',
  /** Sign-in methods this app offers. Google needs Apple as well: the App Store requires it. */
  auth: {
    emailPassword: true,
    anonymous: true,
    apple: false,
    google: false,
  },
} as const

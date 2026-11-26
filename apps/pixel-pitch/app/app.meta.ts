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
  /** iPad and Android tablets too: the game stays a phone-width column in the middle, and rotates on iPad. */
  tablet: true,
  /** Apple Developer team id (Membership details). Signs the iOS app and verifies Universal Links. */
  appleTeamId: '',
  /** One entry per build environment (APP_ENV). Fill in each api address once it exists. */
  // androidSha256: the Play app signing key's SHA-256 for that bundle id (Play Console > App integrity), for App Links.
  environments: {
    dev: { apiUrl: 'http://localhost:3001' },
    staging: { apiUrl: '', androidSha256: [] },
    prod: { apiUrl: '', androidSha256: [] },
  },
  themeColor: '#ffd23f',
  backgroundColor: '#0b1028',
  /** Sign-in methods this app offers. Google needs Apple as well: the App Store requires it. */
  auth: {
    emailPassword: true,
    anonymous: true,
    apple: false,
    google: false,
  },
  /**
   * Native features that need a permission prompt, an entitlement or a config file, so each is off until the app
   * needs it. To turn one on: set it here, add its plugin to package.json with "catalog:" (the list is in
   * tooling/native/lib/native-features.ts), then `pnpm native:configure` writes the permissions. Push also needs the
   * Firebase files in firebase/<env>/ (docs/native-release.md). Permission wording can be replaced with `usage`.
   */
  capabilities: {
    push: false,
    location: false,
    biometrics: false,
    barcode: false,
    audio: false,
    filePicker: false,
    ota: false,
  },
} as const

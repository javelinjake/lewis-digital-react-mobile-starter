import type { NativeCapabilities, UsageStrings } from '../../../packages/config-capacitor/src/identity'

export interface NativeIdentity {
  appId: string
  name: string
  version: string
  buildNumber: number
  hostname?: string
  /** Locks the app. Omit for `any`. */
  orientation?: 'portrait' | 'landscape' | 'any'
  /**
   * False: an iPhone-only app (iPad runs it in iPhone size, portrait). True (the default): a real iPad app. A portrait
   * app then rotates freely on iPad, since iPadOS expects apps to fit any window shape (portrait-only needed
   * `UIRequiresFullScreen`, deprecated in iPadOS 26); the layout keeps a phone-width column centred.
   */
  tablet?: boolean
  /** iOS usage strings shown in permission prompts; required for App Store review. */
  usage: Required<UsageStrings>
  /** Features that need permissions or entitlements. Omitted means all off. */
  capabilities?: Required<NativeCapabilities>
}

export interface TrapezeConfig {
  platforms: {
    ios: Record<string, unknown>
    android: Record<string, unknown>
  }
}

const IOS_PORTRAIT = ['UIInterfaceOrientationPortrait']
const IOS_LANDSCAPE = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
const IOS_ALL = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', ...IOS_LANDSCAPE]

const NO_CAPABILITIES: Required<NativeCapabilities> = {
  push: false,
  location: false,
  biometrics: false,
  barcode: false,
  audio: false,
  filePicker: false,
  ota: false,
}

function iosOrientations(orientation: NativeIdentity['orientation'], tablet: boolean) {
  const phone = orientation === 'portrait' ? IOS_PORTRAIT : orientation === 'landscape' ? IOS_LANDSCAPE : ['UIInterfaceOrientationPortrait', ...IOS_LANDSCAPE]
  const ipad = !tablet ? phone : orientation === 'landscape' ? IOS_LANDSCAPE : IOS_ALL
  return { phone, ipad }
}

/**
 * Android manifest entries this tool owns. Every run deletes all of them and adds back the ones the app's
 * capabilities ask for, so running twice changes nothing and turning a capability off removes its permission.
 * Plugins declare their own permissions in their library manifests too; Gradle merges duplicates.
 */
interface ManagedNode {
  /** XPath of the node to remove before re-adding. */
  match: string
  /** Where it is added. */
  parent: 'manifest' | 'manifest/application' | 'manifest/application/activity'
  xml: string
}

function permission(name: string): ManagedNode {
  return {
    match: `manifest/uses-permission[@android:name="${name}"]`,
    parent: 'manifest',
    xml: `<uses-permission android:name="${name}" />`,
  }
}

function optionalFeature(name: string): ManagedNode {
  return {
    match: `manifest/uses-feature[@android:name="${name}"]`,
    parent: 'manifest',
    // Not required: the store still offers the app to devices without the hardware, and the app falls back.
    xml: `<uses-feature android:name="${name}" android:required="false" />`,
  }
}

function androidNodes(capabilities: Required<NativeCapabilities>, hostname: string | undefined) {
  const byCapability: Array<[boolean, ManagedNode[]]> = [
    [capabilities.push, [permission('android.permission.POST_NOTIFICATIONS')]],
    [capabilities.location, [
      permission('android.permission.ACCESS_COARSE_LOCATION'),
      permission('android.permission.ACCESS_FINE_LOCATION'),
      optionalFeature('android.hardware.location.gps'),
    ]],
    [capabilities.biometrics, [permission('android.permission.USE_BIOMETRIC')]],
    [capabilities.barcode, [
      permission('android.permission.CAMERA'),
      optionalFeature('android.hardware.camera'),
      {
        // Downloads the scanner model with the app from Play, instead of on first scan.
        match: 'manifest/application/meta-data[@android:name="com.google.mlkit.vision.DEPENDENCIES"]',
        parent: 'manifest/application',
        xml: '<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />',
      },
    ]],
  ]

  const appLink: ManagedNode = {
    match: 'manifest/application/activity/intent-filter[@android:autoVerify="true"]',
    parent: 'manifest/application/activity',
    xml: [
      '<intent-filter android:autoVerify="true">',
      '  <action android:name="android.intent.action.VIEW" />',
      '  <category android:name="android.intent.category.DEFAULT" />',
      '  <category android:name="android.intent.category.BROWSABLE" />',
      `  <data android:scheme="https" android:host="${hostname ?? ''}" />`,
      '</intent-filter>',
    ].join('\n'),
  }

  const all = [...byCapability.flatMap(([, nodes]) => nodes), appLink]
  const wanted = [...byCapability.filter(([on]) => on).flatMap(([, nodes]) => nodes), ...(hostname ? [appLink] : [])]
  return { all, wanted }
}

/**
 * Builds the Trapeze configuration object from app metadata so identity lives
 * in `app.meta.ts` and `package.json`, never hand-edited in Xcode or Gradle.
 */
export function buildTrapezeConfig(identity: NativeIdentity): TrapezeConfig {
  const hostname = identity.hostname?.trim() || undefined
  const capabilities = identity.capabilities ?? NO_CAPABILITIES
  const orientations = iosOrientations(identity.orientation, identity.tablet ?? true)

  const infoEntries: Record<string, unknown> = {
    NSCameraUsageDescription: identity.usage.camera,
    NSPhotoLibraryUsageDescription: identity.usage.photos,
    NSPhotoLibraryAddUsageDescription: identity.usage.photos,
    UIViewControllerBasedStatusBarAppearance: true,
    UIStatusBarStyle: 'UIStatusBarStyleDefault',
    // The app only uses standard HTTPS, which is exempt. Saves the export-compliance question on every upload.
    ITSAppUsesNonExemptEncryption: false,
  }
  if (capabilities.location)
    infoEntries.NSLocationWhenInUseUsageDescription = identity.usage.location
  if (capabilities.biometrics)
    infoEntries.NSFaceIDUsageDescription = identity.usage.faceId

  const iosTarget: Record<string, unknown> = {
    bundleId: identity.appId,
    displayName: identity.name,
    version: identity.version,
    buildNumber: identity.buildNumber,
    plist: [
      { replace: false, entries: [infoEntries] },
      {
        // Trapeze merges arrays unless told to replace them, which would keep the template's landscape entries.
        replace: true,
        entries: [
          {
            UISupportedInterfaceOrientations: orientations.phone,
            'UISupportedInterfaceOrientations~ipad': orientations.ipad,
            // Silent pushes wake the app to refresh. Only written when on: an empty list is not worth the risk at
            // review, so turning push off later means deleting this key in Info.plist by hand.
            ...(capabilities.push ? { UIBackgroundModes: ['remote-notification'] } : {}),
          },
        ],
      },
    ],
  }

  // A phone-only app is an iPhone app: on an iPad it runs in iPhone size rather than stretched. Set both ways, so
  // switching `tablet` back on also undoes an earlier iPhone-only run.
  iosTarget.buildSettings = { TARGETED_DEVICE_FAMILY: identity.tablet === false ? '1' : '1,2' }

  const entitlements: Record<string, unknown> = {}
  if (hostname)
    entitlements['com.apple.developer.associated-domains'] = [`applinks:${hostname}`, `webcredentials:${hostname}`]
  // `development` is right in the project: Xcode switches it to `production` when it exports for the App Store.
  if (capabilities.push)
    entitlements['aps-environment'] = 'development'
  if (Object.keys(entitlements).length > 0)
    iosTarget.entitlements = [entitlements]

  const android: Record<string, unknown> = {
    packageName: identity.appId,
    appName: identity.name,
    versionName: identity.version,
    versionCode: identity.buildNumber,
  }

  const { all, wanted } = androidNodes(capabilities, hostname)
  const manifest: Array<Record<string, unknown>> = [
    {
      // Android's cloud backup would restore WebView storage and encrypted credentials whose keys stay behind in
      // the old device's Keystore. The account lives on the server, so a fresh install signs in again instead.
      file: 'AndroidManifest.xml',
      target: 'manifest/application',
      attrs: { 'android:allowBackup': 'false' },
    },
    { file: 'AndroidManifest.xml', delete: all.map(node => node.match).join(' | ') },
  ]

  if (identity.orientation === 'portrait' || identity.orientation === 'landscape') {
    manifest.push({
      file: 'AndroidManifest.xml',
      target: 'manifest/application/activity',
      attrs: { 'android:screenOrientation': identity.orientation },
    })
  }

  for (const parent of ['manifest', 'manifest/application', 'manifest/application/activity'] as const) {
    const xml = wanted.filter(node => node.parent === parent).map(node => node.xml)
    if (xml.length > 0)
      manifest.push({ file: 'AndroidManifest.xml', target: parent, inject: xml.join('\n') })
  }

  android.manifest = manifest

  return {
    platforms: {
      ios: { targets: { App: iosTarget } },
      android,
    },
  }
}

const BUILD_NUMBER_EPOCH = Date.UTC(2025, 0, 1)

/**
 * Monotonic build number: minutes since 2025-01-01. Stays well inside
 * Android's versionCode limit (2.1 billion) for centuries.
 */
export function deriveBuildNumber(now = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - BUILD_NUMBER_EPOCH) / 60_000))
}

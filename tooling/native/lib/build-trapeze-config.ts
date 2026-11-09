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
  usage: {
    camera: string
    photos: string
  }
}

export interface TrapezeConfig {
  platforms: {
    ios: Record<string, unknown>
    android: Record<string, unknown>
  }
}

/**
 * Builds the Trapeze configuration object from app metadata so identity lives
 * in `app.meta.ts` and `package.json`, never hand-edited in Xcode or Gradle.
 */
const IOS_PORTRAIT = ['UIInterfaceOrientationPortrait']
const IOS_LANDSCAPE = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
const IOS_ALL = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', ...IOS_LANDSCAPE]

function iosOrientations(orientation: NativeIdentity['orientation'], tablet: boolean) {
  const phone = orientation === 'portrait' ? IOS_PORTRAIT : orientation === 'landscape' ? IOS_LANDSCAPE : ['UIInterfaceOrientationPortrait', ...IOS_LANDSCAPE]
  const ipad = !tablet ? phone : orientation === 'landscape' ? IOS_LANDSCAPE : IOS_ALL
  return { phone, ipad }
}

export function buildTrapezeConfig(identity: NativeIdentity): TrapezeConfig {
  const hostname = identity.hostname?.trim()
  const orientations = iosOrientations(identity.orientation, identity.tablet ?? true)

  const iosTarget: Record<string, unknown> = {
    bundleId: identity.appId,
    displayName: identity.name,
    version: identity.version,
    buildNumber: identity.buildNumber,
    plist: [
      {
        replace: false,
        entries: [
          {
            NSCameraUsageDescription: identity.usage.camera,
            NSPhotoLibraryUsageDescription: identity.usage.photos,
            NSPhotoLibraryAddUsageDescription: identity.usage.photos,
            UIViewControllerBasedStatusBarAppearance: true,
            UIStatusBarStyle: 'UIStatusBarStyleDefault',
          },
        ],
      },
      {
        // Trapeze merges arrays unless told to replace them, which would keep the template's landscape entries.
        replace: true,
        entries: [
          {
            UISupportedInterfaceOrientations: orientations.phone,
            'UISupportedInterfaceOrientations~ipad': orientations.ipad,
          },
        ],
      },
    ],
  }

  // A phone-only app is an iPhone app: on an iPad it runs in iPhone size rather than stretched. Set both ways, so
  // switching `tablet` back on also undoes an earlier iPhone-only run.
  iosTarget.buildSettings = { TARGETED_DEVICE_FAMILY: identity.tablet === false ? '1' : '1,2' }

  if (hostname) {
    iosTarget.entitlements = [
      { 'com.apple.developer.associated-domains': [`applinks:${hostname}`, `webcredentials:${hostname}`] },
    ]
  }

  const android: Record<string, unknown> = {
    packageName: identity.appId,
    appName: identity.name,
    versionName: identity.version,
    versionCode: identity.buildNumber,
  }

  const manifest: Array<Record<string, unknown>> = []
  if (identity.orientation === 'portrait' || identity.orientation === 'landscape') {
    manifest.push({
      file: 'AndroidManifest.xml',
      target: 'manifest/application/activity',
      attrs: { 'android:screenOrientation': identity.orientation },
    })
  }

  if (hostname) {
    manifest.push(
      {
        file: 'AndroidManifest.xml',
        target: 'manifest/application/activity',
        inject: [
          '<intent-filter android:autoVerify="true">',
          '  <action android:name="android.intent.action.VIEW" />',
          '  <category android:name="android.intent.category.DEFAULT" />',
          '  <category android:name="android.intent.category.BROWSABLE" />',
          `  <data android:scheme="https" android:host="${hostname}" />`,
          '</intent-filter>',
        ].join('\n'),
      },
    )
  }

  if (manifest.length > 0)
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

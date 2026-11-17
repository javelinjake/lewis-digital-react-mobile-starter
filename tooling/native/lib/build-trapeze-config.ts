export interface NativeIdentity {
  appId: string
  name: string
  version: string
  buildNumber: number
  hostname?: string
  /** Defaults to `portrait`. `landscape` locks phones to landscape on iOS and Android. */
  orientation?: 'portrait' | 'landscape'
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
export function buildTrapezeConfig(identity: NativeIdentity): TrapezeConfig {
  const hostname = identity.hostname?.trim()
  const landscape = identity.orientation === 'landscape'

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
            UISupportedInterfaceOrientations: landscape
              ? ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
              : ['UIInterfaceOrientationPortrait'],
            'UISupportedInterfaceOrientations~ipad': [
              'UIInterfaceOrientationPortrait',
              'UIInterfaceOrientationPortraitUpsideDown',
              'UIInterfaceOrientationLandscapeLeft',
              'UIInterfaceOrientationLandscapeRight',
            ],
          },
        ],
      },
    ],
  }

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

  const manifestEdits: Array<Record<string, unknown>> = []

  if (landscape) {
    manifestEdits.push({
      file: 'AndroidManifest.xml',
      target: 'manifest/application/activity',
      attrs: { 'android:screenOrientation': 'sensorLandscape' },
    })
  }

  if (hostname) {
    manifestEdits.push({
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
    })
  }

  if (manifestEdits.length > 0)
    android.manifest = manifestEdits

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

import { join } from 'node:path'

/**
 * Push uses one Firebase app per bundle id, so each APP_ENV has its own pair of files, downloaded from the Firebase
 * console (Project settings > Your apps). They hold public identifiers, not secrets, so they are committed:
 *
 *   apps/<slug>/app/firebase/dev/google-services.json        apps/<slug>/app/firebase/dev/GoogleService-Info.plist
 *   apps/<slug>/app/firebase/staging/...                     apps/<slug>/app/firebase/prod/...
 */
export function firebaseSources(appDir: string, appEnv: string) {
  const dir = join(appDir, 'firebase', appEnv)
  return {
    dir,
    android: join(dir, 'google-services.json'),
    ios: join(dir, 'GoogleService-Info.plist'),
  }
}

/** Where the native projects expect them. The plist must also be in the Xcode target's resources. */
export const FIREBASE_TARGETS = {
  android: 'android/app/google-services.json',
  ios: 'ios/App/App/GoogleService-Info.plist',
  /** Relative to `ios/App`, as the Xcode project names it. */
  iosProjectPath: 'App/GoogleService-Info.plist',
} as const

function androidPackages(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as { client?: Array<{ client_info?: { android_client_info?: { package_name?: string } } }> }
    return (parsed.client ?? []).map(client => client.client_info?.android_client_info?.package_name ?? '')
  }
  catch {
    return []
  }
}

/** Firebase files are per bundle id; copying another environment's file sends tokens to the wrong project. */
export function checkFirebaseBundleId(files: { android?: string, ios?: string }, appId: string): string[] {
  const problems: string[] = []
  if (files.android !== undefined && !androidPackages(files.android).includes(appId))
    problems.push(`google-services.json has no client for ${appId}. Download it from the Firebase app with that package name.`)
  if (files.ios !== undefined && !new RegExp(`<key>BUNDLE_ID</key>\\s*<string>${appId.replace(/\./g, '\\.')}</string>`).test(files.ios))
    problems.push(`GoogleService-Info.plist is for another bundle id, not ${appId}. Download it from the Firebase app with that bundle id.`)
  return problems
}

const MARKER = '// ld:push — forwards APNs to Capacitor for @capacitor-firebase/messaging.'

const METHODS = `
    ${MARKER}
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
`

/**
 * Adds the three AppDelegate methods the Firebase messaging plugin needs, before the class's closing brace. Does
 * nothing if they are already there (by marker, or by hand). Throws when the file does not look like Capacitor's.
 */
export function patchAppDelegate(swift: string): string {
  if (swift.includes(MARKER) || swift.includes('didRegisterForRemoteNotificationsWithDeviceToken'))
    return swift
  const classStart = swift.search(/class AppDelegate\b/)
  const end = swift.lastIndexOf('}')
  if (classStart < 0 || end < classStart)
    throw new Error('AppDelegate.swift does not look like Capacitor\'s template. Add the push methods by hand (docs/native-release.md).')
  return `${swift.slice(0, end).replace(/\s*$/, '\n')}${METHODS}}\n`
}

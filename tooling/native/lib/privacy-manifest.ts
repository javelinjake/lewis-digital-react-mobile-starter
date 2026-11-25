/**
 * The app's iOS privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`). Apple rejects uploads that use a
 * "required reason" API without declaring why. Capacitor's core ships its own manifest, but most plugins do not,
 * so the app declares the reasons for the baseline plugins here:
 *
 *   Preferences   -> UserDefaults    CA92.1  data the app itself wrote and reads
 *   Filesystem    -> File timestamp  C617.1  files inside the app's own container
 *   Device        -> Disk space      85F4.1  shown to the person (getInfo's free space)
 *
 * `native:configure` writes this only when the file is missing, so edits stay. Adding a plugin that uses another
 * such API means adding its reason here (Apple: "Describing use of required reason API").
 * The data the app collects is declared in App Store Connect's privacy labels, not here.
 */
export const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>CA92.1</string>
			</array>
		</dict>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>C617.1</string>
			</array>
		</dict>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>85F4.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`

export const PRIVACY_MANIFEST_TARGET = {
  file: 'ios/App/App/PrivacyInfo.xcprivacy',
  /** Relative to `ios/App`, as the Xcode project names it. */
  projectPath: 'App/PrivacyInfo.xcprivacy',
} as const

# Native release

From a Mac: one-time setup per app, then two commands per release. Uploading and store review stay manual.

## Environments

`APP_ENV=dev|staging|prod` (default `prod`) picks the bundle id, display name and api address from `app.meta.ts`. `.dev` and `.staging` suffixes let all three install side by side. Each bundle id is its own App Store and Play app.

The committed `ios/` and `android/` folders carry the **dev** identity. The release scripts switch to staging or prod for the build and `pnpm native:restore` switches back, so the repo never holds a prod identity.

A native build takes its api address from `environments.<APP_ENV>.apiUrl` (`VITE_API_URL` overrides it). A live native build with no address fails at build time. The build number is minutes since 2025-01-01, set once per release so the bundle and both projects agree.

## One-time setup

### Accounts

- **Apple Developer Program** (£79 / $99 a year). Put the team id (Membership details, 10 characters) in `app.meta.ts` as `appleTeamId`. In Xcode > Settings > Accounts, sign in with that Apple ID.
- **App Store Connect**: My Apps > + > New App, with the prod bundle id. Make a second app for `.staging` only if you want staging on TestFlight under its own name.
- **Google Play Console** ($25 once). Create the app. A new **personal** developer account must run a closed test with at least 12 testers for 14 days before it can publish to production. Organisation accounts are exempt. Check the current rule in Play Console.

Signing on iOS is automatic: with `appleTeamId` set, `native:configure` gives the project the team, and Xcode makes the certificate and profile and turns on the capabilities the entitlements ask for (Push, Associated Domains).

### Android signing

Play signs the app it ships with its own key (Play App Signing). You sign uploads with an **upload key**:

```bash
mkdir -p ~/keys
keytool -genkeypair -v -keystore ~/keys/<slug>-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then create `apps/<slug>/app/android/keystore.properties`. It is gitignored; never commit it.

```properties
storeFile=/Users/<you>/keys/<slug>-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Back up the `.jks` file and both passwords in a password manager. If the upload key is lost, Play support can reset it, but that takes days.

After the first upload, copy the **app signing key** SHA-256 from Play Console > Test and release > App integrity into `environments.prod.androidSha256` (and staging's, if you ship it). App Links need it.

### Links (Universal Links and App Links)

Set `hostname`, `appleTeamId` and each environment's `androidSha256` in `app.meta.ts`. Then:

- `native:configure` adds the associated domains entitlement and the Android intent filter.
- The web build writes `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` for all three bundle ids. A file is left out until its inputs exist.

Deploy the web app before testing a link. iOS caches the association file, so a fresh install is the reliable test.

### Push (optional)

Push goes through Firebase Cloud Messaging on both platforms.

1. **Firebase project**: console.firebase.google.com > Add project. One project can hold every environment.
2. **Apps**: in Project settings > Your apps, add an iOS app and an Android app for each bundle id you build (`uk.co.example.app.dev`, `.staging`, prod). Download each `GoogleService-Info.plist` and `google-services.json` into `apps/<slug>/app/firebase/<env>/`. They hold public identifiers, so commit them. `native:configure` checks each file matches the bundle id being built.
3. **APNs key**: Apple Developer > Certificates, IDs & Profiles > Keys > + > Apple Push Notifications service. Download the `.p8` (you only get it once). In Firebase > Project settings > Cloud Messaging > Apple app configuration, upload it with its Key ID and your team id.
4. **The app**: set `capabilities.push: true` in `app.meta.ts`, add `"@capacitor-firebase/messaging": "catalog:"` to the app's `package.json`, then:
   ```bash
   pnpm install
   APP_ENV=dev pnpm --filter <app> native:configure   # copies the files, entitlement, AppDelegate methods
   pnpm --filter <app> exec cap sync
   ```
   Commit the result.
5. **The api**: Firebase > Project settings > Service accounts > Generate new private key. Put the whole JSON, on one line, in `FIREBASE_SERVICE_ACCOUNT_JSON` on the api's Vercel project. Never commit it.
6. **Test** on a real phone: Settings > Notifications, then Send a test notification.

Server code sends with `sendPushToUser(payload, userId, { title, body, data: { path: '/notes/12' } })` from `@ld/backend`. Tapping the notification opens `data.path`. Tokens Firebase reports as dead are deleted as they are found.

## Releasing

Bump `version` in the app's `package.json` for each new store version. The build number is automatic.

### Android

```bash
pnpm --filter @ld/app-<slug> release:android               # prod
APP_ENV=staging pnpm --filter @ld/app-<slug> release:android
```

It checks the api address and signing files, builds, configures, syncs, runs `bundleRelease` with your upload key, prints the `.aab` path and restores `android/`. If Java is not on your path it uses Android Studio's bundled Java 21.

Upload the `.aab` in Play Console > (app) > Test and release. Start with **Internal testing** (instant, up to 100 testers), then closed testing, then production.

### iOS

```bash
pnpm --filter @ld/app-<slug> release:ios
```

It builds, configures, syncs and opens Xcode with the release identity. In Xcode:

1. Choose **Any iOS Device (arm64)** as the destination.
2. **Product > Archive**.
3. In the Organizer: **Distribute App > App Store Connect > Upload**.

Then put `ios/` back with `pnpm --filter @ld/app-<slug> native:restore`.

The build reaches TestFlight after processing, usually within 30 minutes. Internal testers get it at once; external testers after a short beta review.

### If a release stops half way

The scripts refuse to start with uncommitted changes in `ios/` or `android/`, so `pnpm native:restore` is always safe to run: it puts both folders back to the committed dev identity.

## Store submission

**App Store Connect**: screenshots (6.9" iPhone, and 13" iPad if `tablet` is on), description, keywords, support and privacy policy URLs, App Privacy answers, age rating, and a **demo account** for the reviewer. Pick the build, add review notes, submit. Review takes about a day.

**Play Console**: the store listing, then everything under Policy > App content: privacy policy, ads, Data safety, target audience, content rating. Promote a tested build to production, optionally as a staged rollout.

## Store checklist

- In-app **account deletion** (done in Settings; the backend endpoint exists).
- **Restore purchases** and **Manage subscription** in the shop. The subscription screen shows price, period, what is included, renewal terms, and links to terms and privacy.
- **Sign in with Apple** whenever any other social sign-in is offered.
- A privacy policy, Apple's privacy labels and Google's Data safety form. Analytics is opt-in.
- An honest age rating (in-app purchases). No paid random items unless you have followed the UK loot box principles. Show odds before any random reward.
- Permission wording: the defaults name the app but are generic. Write the real reason in `usage` in `app.meta.ts` before review.
- The iOS privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`, written by `native:configure`) covers the baseline plugins. A new plugin that uses a "required reason" API needs its reason added there.
- Export compliance is answered in `Info.plist` (standard HTTPS only), so uploads do not ask.

## Checks on a device

Playwright emulates a browser, not the native shell. Before each release, on a phone:

- Sign in, sign out, delete account.
- The keyboard does not cover the focused field; Android back steps through history and exits only at the root.
- A link on the website opens the app on the right screen.
- Push, if on: allow, send a test, tap it.
- Purchases in the sandbox, and restore.
- Leaving the app mid-save and coming back: the write is there.

## Running locally

Build against the api on your machine, then open the native project or run it from the command line:

```bash
APP_ENV=dev VITE_DATA_MODE=live pnpm --filter <app> build:native     # api address from app.meta.ts (localhost:3001)
APP_ENV=dev pnpm --filter <app> exec cap sync
```

- **iOS simulator:** reaches the Mac at `localhost`. Xcode needs the iOS platform matching its SDK (Xcode > Settings > Components, or `xcodebuild -downloadPlatform iOS`).
- **Android emulator:** run `adb reverse tcp:3001 tcp:3001` so the emulator's `localhost:3001` is the Mac's. Gradle needs Java 21; Android Studio's bundled one works: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. Plain http to `localhost` is allowed in debug builds only (`android/app/src/debug/res/xml/network_security_config.xml`); release builds are https-only.
- Start the api with `ALLOW_TIME_TRAVEL=1` to skip ahead with the `X-Debug-Now` header in tests.

## Offline playtest build (Android)

For trying the game on a phone with no server. The mock data mode runs the same rules from `core` on the device and keeps the club in `localStorage` (`VITE_MOCK_PERSIST=1`). It hides the cloud and offline UI and adds playtest tools to Settings:

- start the next day or skip ahead
- pretend shop purchases (League Pass, gem packs, a starter bundle)
- top-ups (energy, coins, tokens, packs, goals, Pass XP)
- a club reset

Never ship it.

```bash
APP_ENV=dev VITE_DATA_MODE=mock VITE_ALLOW_MOCK_BUILD=1 VITE_MOCK_PERSIST=1 pnpm --filter <app> build:native
APP_ENV=dev pnpm --filter <app> exec cap sync android
cd apps/<slug>/app/android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

Install with `adb install -r app-debug.apk`, or copy the file to the phone and open it (allow installs from that app). Installing a newer build with `-r` keeps the club.

## Workflows

- `native.yaml` builds unsigned Android and iOS-simulator apps on every native change.
- `release-native.yaml` (manual) is a CI alternative to the release scripts. It has never been run, and its header lists what it needs and what will likely need fixing first.

# Native apps

`ios/` and `android/` are created with `cap add` and then configured from `app.meta.ts`:

```bash
pnpm --filter @ld/app-template exec cap add ios
pnpm --filter @ld/app-template exec cap add android
APP_ENV=dev pnpm --filter @ld/app-template native:configure
pnpm --filter @ld/app-template native:assets
```

Commit both folders. `native:configure` writes the bundle id, name, version, build number, orientation, link domains, Apple team, permission strings, entitlements, Android permissions and the iOS privacy manifest. Running it twice changes nothing.

`pnpm cap:sync` builds with `VITE_BUILD_TARGET=native` first. That bundle does not include the service worker. IndexedDB caching and the outbox still run.

Live reload:

```bash
pnpm --filter @ld/app-template cap:dev:ios
pnpm --filter @ld/app-template cap:dev:android
```

Releasing: [native release](native-release.md).

## Plugins

`@ld/native` is the only package that imports Capacitor plugins. App code imports `@ld/native` and its entry points. The architecture check rejects a plugin import anywhere else, static or dynamic. Each wrapper:

- checks the platform,
- falls back on the web,
- turns plugin errors into small results (`'cancelled'`, `'unavailable'`, ...) instead of throwing.

`cap sync` only links plugins the **app's** `package.json` declares, so every app declares each plugin it uses. `tooling/native/lib/app-plugins.spec.ts` keeps the lists in agreement.

### Baseline: every app has these

No permission prompt or store privacy answer until the app calls them.

| Import | What |
|---|---|
| `@ld/native` | camera and photos, share, haptics, preferences, credentials (Keychain / Keystore), splash, status bar, device, network |
| `@ld/native` | `openInAppBrowser` (terms, help, payments), `copyText` / `readCopiedText`, `exportFile` (share sheet / download) and `appFiles` (private text files) |
| `@ld/native` | `requestStoreReview` (the OS decides if it shows), `checkStoreUpdate` / `installStoreUpdate`, `setAppBadge`, `keepScreenAwake`, `finishInBackground` |
| `@ld/native/react` | network, app state, back button, deep links, keyboard, `useKeepAwake` |
| `@ld/native/notifications` | local notifications through a tested policy (quiet hours, daily cap, enabled types) |
| `@ld/native/social`, `/purchases`, `/orientation` | Apple and Google sign-in, RevenueCat, orientation lock |

### Opt-in: turn on a capability first

Each of these needs a permission string, an entitlement or a config file. Turn it on in `app.meta.ts` `capabilities`, add the plugin to the app's `package.json` with `"catalog:"`, run `pnpm install` and `APP_ENV=dev pnpm native:configure`, then `cap sync`. `native:configure` refuses to run if the two disagree.

| Capability | Import | Plugin | Notes |
|---|---|---|---|
| `push` | `@ld/native/push` | `@capacitor-firebase/messaging` | Firebase setup in [native release](native-release.md#push-optional). No web push. |
| `location` | `@ld/native/location` | `@capacitor/geolocation` | While the app is open. |
| `biometrics` | `@ld/native/biometrics` | `@aparajita/capacitor-biometric-auth` | A local check that the owner is present, not a sign-in. |
| `barcode` | `@ld/native/barcode` | `@capacitor/barcode-scanner` | Raises Android's minimum to API 26. |
| `audio` | `@ld/native/audio` | `@capacitor-community/native-audio` | Sound effects without the WebView's delay. |
| `filePicker` | `@ld/native/file-picker` | `@capawesome/capacitor-file-picker` | Documents. Photos use `pickPhoto`. |
| `ota` | `@ld/native/updates` | `@capgo/capacitor-updater` | Live updates of the web bundle; see [OTA](ota.md). |

Load an opt-in entry lazily (`await import('@ld/native/push')`) from code that only runs when the capability is on. The template's `src/lib/push/` does this, so an app without push never bundles Firebase.

### Adding a new plugin

1. Check it supports the Capacitor major in use, and ships a `Package.swift` (these iOS projects use Swift Package Manager, not CocoaPods). Pick a release at least two weeks old and pin it in the `catalog:` in `pnpm-workspace.yaml`.
2. Add it to `@ld/native`'s `peerDependencies` and `devDependencies`. If it needs a permission or config, add a capability (`packages/config-capacitor/src/identity.ts`), its entry in `tooling/native/lib/native-features.ts`, its manifest and plist entries in `build-trapeze-config.ts`, and mark the peer optional.
3. Write the wrapper in `packages/native/src/` with a web fallback and its own result type, and export it (a new entry point for opt-in ones).
4. Add a unit test if the wrapper maps anything.
5. Add it to the template's `package.json`, and to other apps that should have it.
6. If it uses a "required reason" API, add the reason to the privacy manifest (`tooling/native/lib/privacy-manifest.ts`, and the committed files).

## Background work

No app, native or not, gets to run whenever it likes. What is possible:

- **Finish work after the app is backgrounded.** `finishInBackground(task)` asks the OS for time: about 30 seconds on iOS. The template uses it to finish flushing the outbox when the app is backgrounded.
- **Wake the app from the server.** The server owns time here, so when something is ready it sends a push. That is how a game says "your match is over".
- **Scheduled reminders.** `@ld/native/notifications` schedules local notifications that fire with the app closed.
- **Not built in:** periodic background fetch (`@capacitor/background-runner`; the OS decides when, at best about every 15 minutes, and it runs a separate JS context), background location, and long-running Android work (a foreground service with a visible notification). Each needs a plugin, platform setup and a strong reason at review.

## What still needs native code

These are not plugins. They are extra targets in the Xcode or Gradle project, written in Swift or Kotlin. They live in the committed `ios/` and `android/` folders. `native:configure` only touches the main App target, so it leaves them alone, but it does not set their bundle id or version either. Keep those in step by hand, or extend `build-trapeze-config.ts`.

- Home-screen widgets (WidgetKit on iOS, Glance on Android)
- Live Activities and the Dynamic Island
- Apple Watch and Wear OS apps, CarPlay and Android Auto
- A Notification Service Extension (rich push images on iOS)

## Device checklist

See [native release](native-release.md#checks-on-a-device).

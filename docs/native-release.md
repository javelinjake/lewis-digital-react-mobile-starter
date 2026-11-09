# Native release

## Environments

`APP_ENV=dev|staging|prod` (default `prod`) picks the bundle id, display name and api address from `app.meta.ts`. `.dev` and `.staging` suffixes let all three install side by side.

```bash
APP_ENV=staging pnpm --filter <app> build:native
APP_ENV=staging pnpm --filter <app> native:configure   # applies id, name, version, build number, orientation, links
pnpm --filter <app> exec cap sync
```

Native builds need an absolute `VITE_API_URL` (https). The build number is minutes since 2025-01-01.

## Running locally

Build against the api on your machine, then open the native project or run it from the command line:

```bash
APP_ENV=dev VITE_DATA_MODE=live VITE_API_URL=http://localhost:3001 pnpm --filter <app> build:native
APP_ENV=dev pnpm --filter <app> exec cap sync
```

- **iOS simulator:** reaches the Mac at `localhost`. Xcode needs the iOS platform matching its SDK (Xcode > Settings > Components, or `xcodebuild -downloadPlatform iOS`).
- **Android emulator:** run `adb reverse tcp:3001 tcp:3001` so the emulator's `localhost:3001` is the Mac's. Gradle needs Java 21; Android Studio's bundled one works: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. Plain http to `localhost` is allowed in debug builds only (`android/app/src/debug/res/xml/network_security_config.xml`); release builds are https-only.
- Start the api with `ALLOW_TIME_TRAVEL=1` to skip ahead with the `X-Debug-Now` header in tests.

## Workflows

`native.yaml` builds unsigned Android and iOS-simulator apps on every native change. `release-native.yaml` (manual) builds signed apps and uploads to TestFlight and the Play internal track. It has not been run yet: it needs the secrets listed at its top.

## Store checklist

- In-app **account deletion** (done in Settings; the backend endpoint exists).
- **Restore purchases** and **Manage subscription** in the shop; the subscription screen shows price, period, what is included, renewal terms and links to terms and privacy.
- **Sign in with Apple** whenever any other social sign-in is offered.
- Privacy policy; Apple privacy labels and Google Data safety form (analytics is opt-in).
- Age rating answered honestly (in-app purchases). No paid random items unless you have followed the UK loot box principles.
- Odds shown before any random reward.
- Universal Links and App Links: fill in `hostname`, the Apple team id and the Android signing SHA-256 in `public/.well-known`.

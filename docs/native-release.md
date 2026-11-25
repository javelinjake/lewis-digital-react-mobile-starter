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

## Offline playtest build (Android)

For trying the game on a phone with no server: the mock data mode runs the same rules from `core` on the device, keeps the club in `localStorage` (`VITE_MOCK_PERSIST=1`), hides the cloud and offline UI, and adds playtest tools to Settings: start the next day or skip ahead, pretend shop purchases (League Pass, gem packs, a starter bundle), top-ups (energy, coins, tokens, packs, goals, Pass XP) and a club reset. Never ship it.

```bash
APP_ENV=dev VITE_DATA_MODE=mock VITE_ALLOW_MOCK_BUILD=1 VITE_MOCK_PERSIST=1 pnpm --filter <app> build:native
APP_ENV=dev pnpm --filter <app> exec cap sync android
cd apps/<slug>/app/android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

Install with `adb install -r app-debug.apk`, or copy the file to the phone and open it (allow installs from that app). Installing a newer build with `-r` keeps the club.

## Workflows

`native.yaml` builds unsigned Android and iOS-simulator apps on every native change. `release-native.yaml` (manual) builds signed apps and uploads to TestFlight and the Play internal track. It has not been run yet: it needs the secrets listed at its top.

## Purchases (Pixel Pitch)

1. Create the products in App Store Connect and Google Play with the ids in `config.shop.products` (`pp_starter`, `pp_league_pass`, `pp_chairman_licence`, `pp_gems_80`, `pp_gems_500`, `pp_gems_1100`, `pp_gems_2400`). The Licence is non-consumable; the rest are consumable. None is a subscription.
2. In RevenueCat, add both apps, put every product in the current offering, and set the webhook to `https://<api>/api/purchases/revenuecat` with the Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
3. Build with `VITE_REVENUECAT_IOS_KEY` and `VITE_REVENUECAT_ANDROID_KEY` (public SDK keys), `VITE_TERMS_URL` and `VITE_PRIVACY_URL`. Without a key the shop says purchases are not available.
4. Test with sandbox accounts: a purchase should reach the club within a few seconds of the store's confirmation.

## Store checklist

- In-app **account deletion** (done in Settings; the backend endpoint exists).
- **Restore purchases** in the shop (done). Pixel Pitch sells no subscriptions; an app that does needs **Manage subscription** and a screen with price, period, what is included, renewal terms and links to terms and privacy.
- **Sign in with Apple** whenever any other social sign-in is offered.
- Privacy policy; Apple privacy labels and Google Data safety form (analytics is opt-in).
- Age rating answered honestly (in-app purchases). No paid random items unless you have followed the UK loot box principles.
- Odds shown before any random reward.
- Universal Links and App Links: fill in `hostname`, the Apple team id and the Android signing SHA-256 in `public/.well-known`.

# Native release

## Environments

`APP_ENV=dev|staging|prod` (default `prod`) picks the bundle id, display name and api address from `app.meta.ts`. `.dev` and `.staging` suffixes let all three install side by side.

```bash
APP_ENV=staging pnpm --filter <app> build:native
APP_ENV=staging pnpm --filter <app> native:configure   # applies id, name, version, build number, orientation, links
pnpm --filter <app> exec cap sync
```

Native builds need an absolute `VITE_API_URL` (https). The build number is minutes since 2025-01-01.

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

# Shared packages

| Package | Responsibility |
|---------|----------------|
| `@ld/ui` | DaisyUI primitives, toasts, and a small fade preset |
| `@ld/mobile-ui` | Shell, tab bar, sheets, lists, gestures. No query client, Zustand, or Capacitor |
| `@ld/native` | Capacitor services: camera, share, haptics, preferences, credentials, splash, status bar |
| `@ld/native/react` | Hooks for network, app state, back button, deep links, keyboard, and push. Listeners are reference-counted for Strict Mode |
| `@ld/offline` | IndexedDB storage, scoped keys, write-ahead outbox |
| `@ld/react-utils` | Theme, pagination and `useReducedEffects` (low-effects mode) |
| `@ld/react-utils/query` | `PersistQueryClientProvider` adapter and outbox mutation defaults |
| `@ld/pwa` | Service worker and install prompt. No-op when `VITE_BUILD_TARGET=native` |
| `@ld/forms` | React Hook Form + Valibot fields, plus a dirty-form flag for update prompts |
| `@ld/api-client` | Typed client for one app's backend: Better Auth sign-in (cookie or bearer token), Payload collections, idempotent creates, server actions, account export and delete. Network failures stay `TypeError`s so the outbox can retry them |
| `@ld/backend` | Server only. `createAppBackend` (Payload + Better Auth + Postgres), `ownedCollection`, `defineAction`, RevenueCat webhook, account endpoints, production env guards |
| `@ld/native/notifications` | Local notifications through a tested policy (quiet hours, daily cap, enabled types) |
| `@ld/native/social`, `/purchases`, `/orientation` | Apple and Google sign-in (ID tokens), RevenueCat, orientation lock. Separate entries so apps that do not use them do not bundle them |
| `@ld/game` | Atlas loader, sprites, key-colour recolouring, fixed-step canvas loop, audio manager, integer scaling and 9-slice helpers |
| `@ld/telemetry` | Consent-gated PostHog and Sentry with a typed event map. SDKs load only after consent |
| `@ld/utils` | Framework-free helpers, including the seeded RNG (`random/rng`) |
| `@ld/config-*` | ESLint, TypeScript, Vite, Vitest, Playwright, Capacitor |

Preferences (`createKeyValueStorage`) are for non-secret values such as a cached profile. Tokens use `createCredentialStorage` on native and session cookies on the web.

Declare every Capacitor plugin, including secure storage, on the app `package.json`. `@ld/native` lists them as peer dependencies. `cap sync` reads the app manifest.

`@ld/motion` and `@ld/notifications` are not separate packages. Toasts and the fade preset live in `@ld/ui` until they need their own package.

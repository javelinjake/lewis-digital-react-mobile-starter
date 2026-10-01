# Shared packages

| Package | Responsibility |
|---------|----------------|
| `@ld/ui` | DaisyUI primitives, toasts, and a small fade preset |
| `@ld/mobile-ui` | Shell, tab bar, sheets, lists, gestures. No query client, Zustand, or Capacitor |
| `@ld/native` | Capacitor services: camera, share, haptics, preferences, credentials, splash, status bar |
| `@ld/native/react` | Hooks for network, app state, back button, deep links, keyboard, and push. Listeners are reference-counted for Strict Mode |
| `@ld/offline` | IndexedDB storage, scoped keys, write-ahead outbox |
| `@ld/react-utils` | Theme and pagination hooks |
| `@ld/react-utils/query` | `PersistQueryClientProvider` adapter and outbox mutation defaults |
| `@ld/pwa` | Service worker and install prompt. No-op when `VITE_BUILD_TARGET=native` |
| `@ld/forms` | React Hook Form + Valibot fields, plus a dirty-form flag for update prompts |
| `@ld/directus` | Directus client, errors, pagination, token storage adapter |
| `@ld/utils` | Framework-free helpers |
| `@ld/config-*` | ESLint, TypeScript, Vite, Vitest, Playwright, Capacitor |

Preferences (`createKeyValueStorage`) are for non-secret values such as a cached profile. Tokens use `createCredentialStorage` on native and session cookies on the web.

Declare every Capacitor plugin, including secure storage, on the app `package.json`. `@ld/native` lists them as peer dependencies. `cap sync` reads the app manifest.

`@ld/motion` and `@ld/notifications` are not separate packages. Toasts and the fade preset live in `@ld/ui` until they need their own package.

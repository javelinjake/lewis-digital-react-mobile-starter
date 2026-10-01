# Native apps

`ios/` and `android/` are created with `cap add` and then configured from `app.meta.ts`:

```bash
pnpm --filter @ld/app-template exec cap add ios
pnpm --filter @ld/app-template exec cap add android
pnpm --filter @ld/app-template native:configure
pnpm --filter @ld/app-template native:assets
```

`pnpm cap:sync` builds with `VITE_BUILD_TARGET=native` first. That bundle does not include the service worker. IndexedDB caching and the outbox still run.

App code imports `@ld/native` and `@ld/native/react` only. The app `package.json` still depends on each plugin so Capacitor can discover them.

Live reload:

```bash
pnpm --filter @ld/app-template cap:dev:ios
pnpm --filter @ld/app-template cap:dev:android
```

## Device checklist

Playwright phone and tablet projects emulate a browser. They do not exercise the Capacitor runtime. On a simulator or device, check:

- Keyboard inset does not cover the focused field (`useKeyboard`, Keyboard `resize: body`)
- Android back moves through history, and exits only at the root (`useBackButton`)
- A universal link or custom scheme opens the matching route (`useDeepLinks`)
- Resuming the app calls `outbox.flush()` (`useAppState`)

Credential storage uses the secure-storage plugin (Keychain on iOS, Keystore on Android). Do not put tokens in Preferences.

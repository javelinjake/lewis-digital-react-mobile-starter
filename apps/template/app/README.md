This app is the starter template for new React mobile apps.

Copy it with `pnpm create:app`. Existing apps do not inherit later template edits. Shared code belongs in `packages/*`.

## Identity

`app.meta.ts` feeds the web manifest, `capacitor.config.ts`, and `pnpm native:configure`.

## Run

```bash
pnpm dev
pnpm cap:dev:android
pnpm cap:dev:ios
pnpm test:e2e
```

`ios/` and `android/` are added with `cap add` and are not committed in the template until you generate them.

## Offline demo

`features/notes` persists creates through the outbox. The in-memory API upserts on the client id. Swap `features/notes/api/notes-api.ts` for Directus when building a real feature, and keep the handler idempotent on the server as well.

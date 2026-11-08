# Monorepo

pnpm workspace globs are `apps/*/*` (each product is `apps/<slug>/{app,api,core}`), `packages/*`, and `tooling/*`. Versions for shared libraries live in the `pnpm-workspace.yaml` catalog.

`app.meta.ts` is the identity source for the web manifest, Capacitor config, and Trapeze (`pnpm native:configure`).

`pnpm create:app` copies the template's `app` and `api`, rewrites identity, gives the api its own database and registers the app in `tooling/apps/apps.config.json`. See the [new app playbook](new-app-playbook.md).

Turborepo caches `build` and `build:native` separately. Both tasks list `APP_ENV` and every `VITE_*` variable as inputs, and `VERCEL_*` and `CI` are passed through. `cap:sync`, `native:configure`, and `native:assets` are not cached. `cap:sync` depends on `build:native`.

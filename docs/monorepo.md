# Monorepo

pnpm workspace globs are `apps/*`, `packages/*`, and `tooling/*`. Versions for shared libraries live in the `pnpm-workspace.yaml` catalog.

`app.meta.ts` is the identity source for the web manifest, Capacitor config, and Trapeze (`pnpm native:configure`).

`pnpm create:app` copies `apps/template`, rewrites the package name and `app.meta.ts`, and can write `cms/projects/<slug>/project.json` with `platform: "react"`.

Turborepo caches `build` and `build:native` separately. Both tasks list `VITE_BUILD_TARGET`, `VITE_DIRECTUS_URL`, and `VITE_FRONTEND_URL` as inputs. `cap:sync`, `native:configure`, and `native:assets` are not cached. `cap:sync` depends on `build:native`.

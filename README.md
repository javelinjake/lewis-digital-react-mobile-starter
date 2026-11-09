# Lewis React Mobile Platform

pnpm + Turborepo monorepo for **mobile** apps and games. Each product is a React client that runs in the browser as an installable PWA and ships to the App Store and Google Play through Capacitor, plus its own Payload + Better Auth backend deployed to Vercel. Branding differs per app; everything else is shared.

## Structure

```txt
apps/<slug>/
  app/     React + Capacitor client      (@ld/app-<slug>)
  api/     Payload + Better Auth backend (@ld/api-<slug>), one database per app
  core/    games only: pure, deterministic rules shared by app and api
  art/     games only: source art, sheets and audio
packages/  Shared @ld/* packages (backend, api-client, native, ui, mobile-ui, game, telemetry, ...)
tooling/   Generators, CI scripts, native scripts, architecture check, local database
docs/      Documentation
```

## Quick start

```bash
pnpm install
pnpm db:dev                                   # local Postgres (or: pnpm db:up for Docker). Leave it running
pnpm --filter @ld/api-template cms:migrate
pnpm --filter @ld/api-template dev            # the backend on :3001
pnpm --filter @ld/app-template dev             # the app on :5173 (mock data until VITE_DATA_MODE=live)
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm review` | lint + types + unit tests + architecture check |
| `pnpm test:tooling` | tests for the scaffolder, Vercel config and native config |
| `pnpm --filter <api> test:integration` | access-control, auth and purchase tests against real Postgres |
| `pnpm --filter <app> test:e2e` | Playwright on phone, iPhone and (if enabled) tablet |
| `pnpm create:app -- --name "My App" [--kind game]` | Scaffold a new app. Dry run until you add `--write` |
| `pnpm db:dev` / `db:up` / `db:down` | Local Postgres without Docker / with Docker / stop Docker |
| `pnpm --filter <app> build:native`, `cap:dev:ios`, `cap:dev:android` | Native bundle and live reload |

## CI

Pull requests run, for what they affect: lint, types, architecture and unit tests; for each client app a production build, bundle budget, mobile Lighthouse (PWA apps) and Playwright; for each api a real Postgres with migrations, integration tests and a production build. Native builds run for apps that have iOS or Android projects. Signed releases are a manual workflow. Vercel deploys.

## Documentation

- [New app playbook](docs/new-app-playbook.md): start here for a new app or game
- [Backend](docs/backend.md): accounts, privacy model, actions, purchases
- [Deployment](docs/deployment.md): Vercel projects and environment variables
- [Native release](docs/native-release.md): environments, signing, store checklist
- [Games](docs/games.md): the rules package, server-owned time, the game kit
- [Monorepo](docs/monorepo.md), [Architecture](docs/architecture.md), [Shared packages](docs/shared-packages.md), [Native apps](docs/native.md), [PWA and offline](docs/pwa-offline.md)

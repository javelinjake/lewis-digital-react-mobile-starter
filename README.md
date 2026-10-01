# Lewis React Mobile Platform

pnpm + Turborepo monorepo for **mobile and tablet** apps. Touch-first React/Directus apps run in the browser as installable PWAs and ship to the App Store and Google Play through Capacitor.

## Structure

```txt
apps/           Product apps (template, then apps)
packages/       Shared @ld/* packages
tooling/        Generators, native scripts, architecture checks
cms/            Directus project markers
docs/           Monorepo documentation
```

## Quick start

```bash
pnpm install
cp apps/template/.env.local.example apps/template/.env.local
pnpm --filter @ld/app-template dev
```

## Commands

| Command                                          | Purpose                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`                                       | Run app dev servers                                               |
| `pnpm --filter @ld/app-template dev`             | Template app in the browser                                       |
| `pnpm --filter @ld/app-template build`           | Web PWA build (`VITE_BUILD_TARGET=web`)                           |
| `pnpm --filter @ld/app-template build:native`    | Capacitor bundle with no service worker                           |
| `pnpm --filter @ld/app-template cap:dev:ios`     | Live reload on an iOS simulator                                   |
| `pnpm --filter @ld/app-template cap:dev:android` | Live reload on Android                                            |
| `pnpm review`                                    | lint + types + unit tests + architecture check                    |
| `pnpm test:e2e`                                  | Playwright on phone and tablet profiles                           |
| `pnpm create:app`                                | Scaffold an app from the template                                 |
| `pnpm create:project`                            | Same scaffold, with a Directus project marker (`platform: react`) |

## Documentation

- [Monorepo](docs/monorepo.md)
- [Architecture](docs/architecture.md)
- [Shared packages](docs/shared-packages.md)
- [Native apps](docs/native.md)
- [PWA and offline](docs/pwa-offline.md)

# Lewis Digital Monorepo Rules

This is a pnpm + Turborepo monorepo of mobile apps and shared packages. Each product is a folder `apps/<slug>/` with a React + Capacitor client (`app`), a Payload + Better Auth backend (`api`), and for games a pure rules package (`core`). Clients run as offline-capable PWAs and ship to the App Store and Google Play via Capacitor. The backend deploys to Vercel.

Default to app-local changes.

Files inside packages/* are live shared code.

Apps own features, routes, pages, tab definitions, `app.meta.ts`, themes, which mutations are queued, push handling, deep links, collections, game rules and product copy.

Shared packages own reusable UI, utilities, React hooks, Capacitor wrappers, the mutation outbox, service worker registration, the backend factory (`@ld/backend`), the api client, telemetry and the game kit.

## Before you say work is done

Run `pnpm review`, and the build of any app you touched. For an api, run its integration tests (`pnpm db:dev`, then `pnpm --filter <api> test:integration`). Say so if something was not run. Never commit `.env*` files or secrets. Do not push, tag or deploy unless asked.

## Client rules

DaisyUI is the only UI layer. Do not build a second component kit.

TanStack Query is server state. Zustand is session status and UI state. Zustand must not persist credentials.

The outbox is the only durable write queue. Do not also persist TanStack mutations. A feature that needs offline writes uses it; an online-only game does not.

@ld/native is the only package that imports Capacitor plugins (including notifications, social sign-in and purchases). App `package.json` files still declare those plugins so `cap sync` can see them. The one exception is `@ld/telemetry`, which may import the Sentry Capacitor SDK.

Do not read `navigator.onLine` or register service workers in apps.

Do not store auth tokens in Preferences or `localStorage`. Web auth uses the session cookie through the `/api` rewrite. Native auth keeps the session token in the credential adapter (Keychain / Keystore).

Anything starting `VITE_` ships to every user. Never put a secret in one. Public SDK keys (RevenueCat, PostHog, Sentry DSN) are fine.

Import direction is pages/routes → features → shared packages. `src/app` may register feature outbox handlers. A client may only `import type` from its own api package, and never imports `payload` or `@ld/backend`.

Every screen must render with cached data, a pending state, or an empty state. Do not block the UI on being online.

The service worker caches the app shell only. It must never cache `/api` responses: they belong to one user and a URL-keyed cache is shared by everyone on the device.

Ask "who am I" with the api client's `getSession()` (Better Auth). Payload's `/users/me` returns 500 for a bearer token. Better Auth ids are strings; Payload ids are numbers; convert at every boundary (`toPayloadId`).

## Backend rules

Every collection that holds user data is declared with `ownedCollection(...)`. It adds the owner, owner-scoped access and the idempotent create. A collection with no user data is marked `// architecture: public-data`. The architecture check fails otherwise.

Anything that grants, charges or rolls (a reward, a pack, a purchase effect) is a `defineAction`: authenticated, idempotent on an `Idempotency-Key`, rate limited, in one transaction. The server decides; the client asks.

The server owns time. Store timestamps, never counters, and compute elapsed time from the server clock. Never trust a time sent by the client.

Action paths must not start with a collection or global slug (Payload would never route them). Use `/actions/...` or a feature prefix like `/game/...`.

Use `access.read`/`update` that returns a `where` constraint on the caller's own id. Never build one from the requested id (`selfOrAdmin` once did, and let any member read any user).

Run the api integration tests against a real Postgres. They are the proof that one user cannot reach another's data.

## Games

Game rules live in `core`: pure functions of `(state, config, now, seed)`, deterministic (`@ld/utils/random/rng`, no `Math.random` or `Date.now`), with no React, Capacitor or Payload. The app uses them for previews and the api for outcomes, so the numbers always match. Every number lives in the config, never in code.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

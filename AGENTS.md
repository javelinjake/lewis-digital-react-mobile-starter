# Lewis Digital Monorepo Rules

This is a pnpm + Turborepo monorepo of React/Directus mobile apps and shared packages. Apps run as offline-capable PWAs and ship to the App Store and Google Play via Capacitor.

Default to app-local changes.

Files inside packages/* are live shared code.

Apps own features, routes, pages, tab definitions, `app.meta.ts`, themes, which mutations are queued, push handling, deep links, Directus schemas, and product copy.

Shared packages own reusable UI, utilities, React hooks, Capacitor wrappers, the mutation outbox, and service worker registration.

DaisyUI is the only UI layer. Do not build a second component kit.

TanStack Query is server state. Zustand is session status and UI state. Zustand must not persist credentials.

The outbox is the only durable write queue. Do not also persist TanStack mutations.

@ld/native is the only package that imports Capacitor plugins. App `package.json` files still declare those plugins so `cap sync` can see them.

Do not read `navigator.onLine` or register service workers in apps.

Do not store auth tokens in Preferences or `localStorage`. Web auth uses session cookies. Native auth uses the credential adapter (Keychain / Keystore).

Import direction is pages/routes → features → shared packages. `src/app` may register feature outbox handlers.

Every screen must render with cached data, a pending state, or an empty state. Do not block the UI on being online.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

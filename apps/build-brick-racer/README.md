# Build Brick Racer

Build a toy car from interlocking bricks, drive it around oversized kitchen and garden courses, change it, and drive again.
Landscape, offline-first, single player. Built on the Lewis Digital React/Capacitor starter (Vite, Tailwind + DaisyUI, Zustand,
Capacitor via `@ld/native`) with Three.js for rendering and Rapier (WASM) for the rigid body underneath the vehicle model.

Working title "Build Brick Racer". No official brand assets are used; backdrops and typography are placeholders (see `docs/TASKS.md`).

## Run

```bash
pnpm install
pnpm --filter @ld/app-build-brick-racer dev            # browser dev server
pnpm --filter @ld/app-build-brick-racer build          # web PWA build (VITE_BUILD_TARGET=web)
pnpm --filter @ld/app-build-brick-racer build:native   # Capacitor bundle, no service worker
pnpm --filter @ld/app-build-brick-racer test:unit      # vitest (game rules, physics, persistence, UI logic)
pnpm --filter @ld/app-build-brick-racer architecture:check
```

End-to-end tests use landscape phone and tablet profiles (Chromium). Against a server you started yourself:

```bash
E2E_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium pnpm --filter @ld/app-build-brick-racer test:e2e
```

Without `E2E_BASE_URL` Playwright builds and previews the app first. Headless runs use software WebGL, so they check behaviour,
not device performance.

Native projects are not committed. Add them with `cap add ios` / `cap add android`, then `native:configure` (this app sets
`orientation: 'landscape'` in `app.meta.ts`, which the shared PWA manifest and Trapeze config honour).

## Layout

```txt
src/game/        Pure TypeScript domain, no React: lattice + catalogue (36 parts), build edits (transactions, undo,
                 mirror, wheel groups), vehicle compile + simulation, environments, challenges, replay, persistence
src/render/      Three.js render kit (procedural geometry, no asset files)
src/stores/      Zustand: editor (undo + autosave), garage, prefs, session flow, app lifecycle
src/features/    builder, driving, replay, garage, challenges, results, settings (features never import each other)
src/pages/       Thin route pages
src/lib/audio/   Procedural WebAudio
```

Architecture notes live in `docs/` here and in the monorepo `docs/build-brick-racer.md`.

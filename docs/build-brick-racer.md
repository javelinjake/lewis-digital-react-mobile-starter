# Build Brick Racer

Offline, landscape toy-car game in `apps/build-brick-racer`. It is app-local code: nothing in `packages/*` is game specific. The
only shared changes are additive (`orientation` for the PWA manifest and the native Trapeze config).

## Why Three.js and Rapier

The kit has no 3D engine. Rendering is plain Three.js driven imperatively (the car, the garage and the replay are mostly generated,
merged geometry). Rapier (WASM) owns rigid-body integration, the compound collider and ray casts; the tyre, motor, brake, aero and
steering-assist model sits on top as impulses. The simulation interface (`src/game/vehicle/sim.ts`, `world.ts`) is the only place that
knows about Rapier, so the editor, saves and replays are engine independent.

## Game loop

Fixed 60 Hz physics (two Rapier substeps per tick) with interpolated visuals. Input is sampled into ticks. Nothing renders React per
frame: HUD values are written outside React state.

## Data and persistence

Cars are lattice data (studs X/Z, plates Y, quarter-turn yaw). Connections are re-derived from transforms. Every edit is a transaction
with undo. Local persistence (IndexedDB via `@ld/offline`) uses checksummed two-slot car saves, a journal for run + personal-best
commits, immutable per-revision car snapshots, a replay storage budget and explicit migrations. There is no server, so the outbox is
not used; the TanStack query layer is not needed either.

## Units

One stud is 0.05 m, one plate 0.02 m (6.25x a real brick). Speeds are shown in game metres per second at that toy scale. The
conversion lives in `src/game/units.ts`; physics tuning lives in `src/game/vehicle/physics-config.ts` and is versioned.

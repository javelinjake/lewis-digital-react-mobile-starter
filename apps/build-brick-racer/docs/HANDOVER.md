# Build Brick Racer: handover report

Against `Brick_Car_Game_Build_Spec.md` v1.0 (complete V1). Section 21 features are not built and their flags stay false.

## How to run

```bash
pnpm install
pnpm --filter @ld/app-build-brick-racer dev          # browser
pnpm --filter @ld/app-build-brick-racer build        # production PWA bundle (offline capable, ~6 MB precache)
pnpm --filter @ld/app-build-brick-racer test:unit    # 225 tests
```

End-to-end (landscape phone and tablet, Chromium) runs against a production bundle with the test hooks switched on:

```bash
VITE_E2E=true pnpm --filter @ld/app-build-brick-racer exec vite build --outDir dist-e2e
pnpm --filter @ld/app-build-brick-racer exec vite preview --outDir dist-e2e --port 4173
E2E_BASE_URL=http://127.0.0.1:4173 PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium \
  pnpm --filter @ld/app-build-brick-racer exec playwright test --project=phone
```

Normal builds contain no test hooks. To demonstrate a run from the normal garage flow, run `tests/e2e/journey.spec.ts`
(clean profile, no seeding: Build a car, Racer, Drive, Kitchen Quick Start, throttle to the finish, results with personal
best, details, replay, garage).

## What was verified, and on what

| Check | Result |
| --- | --- |
| CI command `turbo run lint ts test:unit architecture:check build` for the whole monorepo | 63 of 63 tasks pass. App lint: 0 errors, 15 advisory warnings (see gaps) |
| `pnpm test:native-tooling` | 5 of 5 pass (includes the new landscape orientation cases) |
| Unit tests (vitest, jsdom, real Rapier WASM) | 225 pass in 27 files |
| e2e, phone profile (Pixel 7 landscape emulation), production bundle | 33 of 33 pass (includes journey and offline), plus AC04 run on its own: 34 of 34 |
| e2e, tablet profile (iPad Pro 11 landscape emulation, Chromium, device pixel ratio 1) | 33 of 33 pass (10.7 minutes). AC04 was not run on the tablet profile |

**Platforms actually used:** headless Chromium on Linux with software WebGL (SwiftShader), emulating phone and tablet landscape
viewports with touch. Node 22, Three.js 0.187, Rapier 0.21 (WASM), React 19, Vite 7. **No real phone or tablet, no iOS or Android
native build, and no real GPU was used.** Frame rate and touch latency on devices are unmeasured.

Development-machine figures (not device figures): physics 0.1 to 0.3 ms per tick (500-part car 0.29 ms); compiling a 500-part car
45 ms into 12 merged colliders; render triangles racer 8.3k, 250-part car 77k, 500-part car 154k; headless frame time about
16.7 ms at 844x390 on an idle machine; Rapier chunk 4.3 MB (loaded only when driving, precached for offline).

## Milestones

| Milestone | Result |
| --- | --- |
| M0 Project integration | Done. New app from the template, landscape tooling, Three.js and Rapier added, units in one file (`src/game/units.ts`, stud 0.05 m), runnable scene and a manually driven starter on a test surface (sim tests) |
| M1 Build-to-drive loop | Done. Parts, snap placement, derived mass, connected-assembly compilation, kitchen ramp. Build edits change the run: ballast and wheel tests (AC11 to AC13) |
| M2 Building and saves | Done. Easy and Free on one document, all 36 parts, wheel groups, undo, validation, journalled garage, migrations |
| M3 Challenges and environments | Done. Kitchen and Garden, eight rulesets, free drive, surfaces, aero, drift. All eight run end to end through the real session for both starters (calibration suite) |
| M4 Feedback and cameras | Done. Results comparison, details, four live cameras with smart mode and lock, replay from recorded state |
| M5 Child usability and visual finish | Built (screens match the supplied boards, tutorial, touch layouts, assistance, procedural audio, effects). **No usability session was run** |
| M6 Release verification | Partly. Automated verification, migration and recovery tests, stress tests and an independent code audit are done. Target-device testing was not possible |

## Acceptance criteria

Status words: **Verified** = automated test passed; **Seen** = also reviewed in screenshots; **Partial** and **Not verified** are explained.

| ID | Status | Evidence |
| --- | --- | --- |
| AC01 | Verified | e2e: Try a car reaches driving; Build a car, starter, builder; journey spec; drive spec |
| AC02 | Verified, seen | builder e2e AC02: touch placement, rotate, recolour, remove |
| AC03 | Verified | builder e2e AC03 and editor store tests: customised car survives Easy/Free switching |
| AC04 | Verified (phone profile) | Catalogue test (36 definitions, unique, placeable) passes. e2e AC04 chooses and places every one of the 36 parts twice with touch taps (2.7 minutes on software WebGL). Not run on the tablet profile |
| AC05 | Verified | stress tests: 1, 2, 3, 4, 6 and 8 wheel cars and a tall car compile and simulate stably; warnings, not blocks |
| AC06 | Verified | unit and e2e: invalid placement shows a reason and commits nothing |
| AC07 | Verified | unit: mirror pair and paired wheel swap are one transaction and undo/redo in one step |
| AC08 | Verified | unit and e2e: removing a supporting piece keeps pieces and identifies them as loose |
| AC09 | Verified | input tests; all driving input comes from player controls. The scripted driver exists only in `tests/unit/autopilot.ts` |
| AC10 | Verified | pointer-ownership unit tests; e2e separate touches; focus loss pauses and clears input |
| AC11 | Verified | unit: ballast changes mass and centre of mass by position |
| AC12 | Verified | sim: heavier car takes 1.7x as long to reach the same speed on equal grip and motor |
| AC13 | Verified | unit: larger wheels change clearance and wheel-bottom height; body grounding represented |
| AC14 | Verified | sim: same shared motor gives the same time on grippy plastic for 2WD and 4WD, 4WD crosses mud where 2WD stalls |
| AC15 | Verified | sim: a car straddling tile and mud reads tile on one side, mud on the other, per wheel |
| AC16 | Verified | compile: hidden parts add no frontal or top area; sim: larger area gives more drag |
| AC17 | Verified | all eight challenges and both free-drive areas run; e2e challenge selection and drive |
| AC18 | Verified | rule tests: out-of-order gates and shortcuts never finish; ended runs have no time |
| AC19 | Verified | rule tests: entry-speed band, wall, lane, reset invalidation; drift rejects stationary wheelspin, spins, reversing, walls |
| AC20 | Verified | session test and e2e: reset restores a safe pose, clears velocity, marks practice |
| AC21 | Verified, seen | camera unit tests (stays behind the car, smart-camera safety rules, lock); screenshots in each camera |
| AC22 | Verified | run-flow test: replay matches the recorded run and uses the saved snapshot after the car is edited; replay e2e |
| AC23 | Verified | comparison tests and results view-model: compatible runs only, correct improvement direction, signature kept |
| AC24 | Verified | persistence round trip of parts, connections, roles, colours and forward direction |
| AC25 | Verified | interrupted and damaged writes recover the last complete car; retried saves do not duplicate (run id fix) |
| AC26 | Verified | v0 migration with backup; unknown parts stay saved and block driving with a named cause |
| AC27 | Verified | garage rename, duplicate, delete with confirmation; snapshots survive deleting a car |
| AC28 | Verified | offline e2e: after first load, network cut, reload, build screens and start a drive (needs the cached Rapier chunk), no foreign requests |
| AC29 | Verified | e2e: left-handed, control size, reduced motion, mute persist; layouts seen in screenshots |
| AC30 | **Not verified** | no device. Development-machine and software-GL figures above only |
| AC31 | **Not verified** | no child usability session was run |
| AC32 | Seen | one theme (navy, cyan, orange, chamfered panels, italic display type) across builder, HUD, garage, results |

## Divergences from the spec

- **Engine choice.** Three.js is driven imperatively (no react-three-fiber). Rapier owns the rigid body and collisions; the wheel, tyre, motor,
  brake, aero and assist model is mine and sits behind `src/game/vehicle/sim.ts` as the spec allows.
- **Orientations.** Parts rotate in four yaw quarter-turns, not all 24 orientations. Slopes, wedges and curves use their bounding box
  for overlap and collision. Connectors are studs, sockets and wheel axles only.
- **Gameplay tuning in the tyre model.** A documented `powerSlide` factor reduces a driven tyre's lateral grip so power slides are possible.
  Without it the cars understeered and could not drift at reachable speeds.
- **Calibration.** The "Great run" thresholds and the physics constants come from scripted input traces on the two starters, not from people.
  They are provisional (`docs/TASKS.md`). The Buggy rarely drifts with the scripted driver.
- **No outbox or query cache.** There is no server, so the kit's outbox and TanStack Query are unused; Zustand holds UI state and IndexedDB holds data.
- **Shared kit changes (additive).** `@ld/config-vite` gained `orientation` and `maxPrecacheFileSizeBytes`; the native Trapeze config and
  `configure.ts` gained `orientation`; catalogue entries for Three.js, Rapier and fonts; the apps registry; `.gitignore`.
- **Visual direction.** Built from the eight supplied boards. Backdrops are CSS gradients standing in for the photographic scenes. Fonts are
  bundled Exo 2 (display) and Nunito (body). No official brand assets were supplied or used.

## Known gaps and risks

- Real-device frame rate, touch latency and the 500-part case on a phone are unmeasured. The service worker also precaches a 4.3 MB physics
  file, which makes first install heavy on slow networks.
- Builder snap rings are dense over a small car at default zoom on a phone. Picking uses a 28 px radius and press-slide-release, but this needs a
  child-usability session (AC31).
- Audio and haptics are unit-tested for their maths only; nothing audible was checked.
- IndexedDB in a WebView can be cleared by the operating system under storage pressure. Cars are not mirrored to native file storage.
- Android: the `android/` project is generated and a debug APK builds (12.6 MB, debug-signed, landscape). It has **not been installed or run on a
  device or emulator**. No iOS project was generated (needs Xcode). Launcher icon and splash are Capacitor defaults. The manifest asks for notification
  permissions through the unused push plugin; remove it before store submission. See `docs/build-brick-racer.md`.
- 15 advisory lint warnings (`set-state-in-effect`) remain where components sync with an external viewport controller.
- Two items from an independent audit are accepted as design: moving a car's root piece away selects the wheeled assembly instead; a one-wheel car
  can finish Plank Jump because the rule asks for wheel contact, not two wheels.

## Final status

| Item | Result |
| --- | --- |
| Unit tests | 225 of 225 pass |
| CI command for the whole monorepo | 63 of 63 tasks pass |
| e2e phone profile | 33 of 33 pass, plus AC04 (34 of 34 run) |
| e2e tablet profile | 33 of 33 pass at device pixel ratio 1 |
| AC04 e2e | Passes on the phone profile. Not run on the tablet profile |
| AC30 (real-device performance), AC31 (child usability) | Not verified. No device or child session was available |

Notes from the last verification pass:

- The tablet profile runs at device pixel ratio 1. At ratio 2 the software WebGL renderer in the test container stalls on the tablet-sized
  canvas. This is a limit of the test machine, not a measured limit of the game.
- The first AC04 run failed twice, both times from the test and not the game. The test placed wheel mounts loose, where the camera
  could not see them, and then needed a hub ring on screen. The test now fits mounts onto the chassis and steps through the camera
  presets when no ring is in view.
- That run did show something for the usability session (AC31): the builder camera stays where the player left it as the car grows, so a
  new mount or wheel can land out of view until the player moves the camera or taps a view preset. Rings and wheels place correctly once
  they are in view. An automatic re-frame after a placement would help young players and has not been built.

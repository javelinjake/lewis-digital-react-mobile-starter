# Build Brick Racer: task tracking

The starter kit has no issue tracker, so implementation gaps, provisional values and unavailable assets are recorded here.
Keep this file current when work lands.

## Unavailable assets and placeholders

- Official brand assets, logos, decals and a final release identity were not supplied. The working title is "Build Brick Racer".
- Backdrops behind the screens are CSS gradients standing in for the blurred photographic scenes of the design boards.
- Environment props are procedural primitives with generated textures; no authored models or licensed artwork.
- All sound is generated at runtime (WebAudio). No recorded audio.
- App icon and splash are placeholders (`public/favicon.svg`).

## Provisional tuning (needs playtesting)

- Physics configuration v1 (`src/game/vehicle/physics-config.ts`): motor curve, grip tables, power-slide factor, assist strength.
- "Great run" thresholds in `src/game/challenges/{kitchen,garden}.ts` were calibrated from scripted input traces on two starters.
- Drift scoring constants and the Slide Corner geometry; the Buggy rarely drifts with the scripted driver.
- Camera presets and the smart camera volumes in `src/game/env/*.ts`.

## Verification not possible in the build sandbox

- Frame rate and touch latency on a real phone and tablet (AC30): only desktop and software-GL headless checks were run.
- Child usability sessions (AC31): none were run. Record observations here after a session.
- Native iOS and Android builds were not generated or run.

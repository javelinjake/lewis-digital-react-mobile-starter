# Pixel Pitch art

- `source/` is the asset pack as delivered: sprites, sheets, audio, the palette and `gen.py`, which regenerates all of
  it from code (`python3 gen.py`, needs Pillow and NumPy). `source/README.md` describes every folder.
- `build.ts` copies what the app draws into `../app/src/assets/game/`. Run it after changing the pack:
  `pnpm --filter @ld/app-pixel-pitch art:build`. The copies are committed, so builds never need Python.

Scale pixel art by whole numbers only, with `image-rendering: pixelated`. Sound effects are converted to mono AAC
`.m4a` (needs ffmpeg, or macOS's afconvert). The music loop is not used yet.

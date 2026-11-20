# Pixel Pitch: V1 asset pack

Original pixel art and chiptune sound effects for the V1 scope. Everything here was generated for this project and is yours to use and change. `manifest.json` lists every file with its size and what it's for.

## Folders

| Folder | What's in it |
| --- | --- |
| `sprites/players/` | Layered player parts, 12×16: `body/` (5 skin tones), `hair/` (7 styles × 6 colours, plus bald = no layer), `kit/` (5 shirt patterns, shorts, socks, boots, GK gloves) |
| `sprites/cards/` | Card frames for the 5 rarities (48×64), card back, Star/Legend glow |
| `sprites/packs/` | League packs L5–L1 (bronze, silver, gold, holo, legend), each also split into `_top` / `_bottom` for the rip |
| `sprites/icons/` | Currency icons (coin, gem, token, pack, trophy, star, points) and 24 white UI icons, all 12×12 |
| `sprites/badges/` | Position badges (GK/DEF/MID/FWD) and tags (fit %, NEW, UPGRADE, DUPE, SOLD, LOCKED) |
| `sprites/crests/` | 4 crest bases (templates) + 8 emblems |
| `sprites/flags/` | The 4 fictional nations |
| `sprites/pitch/` | Grass tile, squad half-pitch (176×130), match pitch (176×76), ball frames, crowd strip |
| `sprites/club/` | Stadium at 3 stages (levels 1–3, 4–7, 8–10) |
| `sprites/text/` | Pixel text banners (GOAL!, PERFECT!, PROMOTED!, WIN!, …) |
| `sprites/ui/` | 9-slice buttons (6 colours), panels, pitch slot frames, progress bars, warm-up timing bar + marker, pack shelf slots |
| `sheets/` | Sprite sheets + JSON atlases (TexturePacker "hash" format): player animation, example players, cards, packs, pack rip, ball, crowd, FX, icons, badges, crests, banners |
| `app/` | App icon 1024, Android adaptive foreground, splash 1170×2532, wordmark |
| `audio/sfx/` | 27 sound effects (22 kHz mono WAV) |
| `audio/music/` | 16-second chiptune menu loop (placeholder) |
| `palette/` | `.gpl` palette for Aseprite/GIMP and `palette.json` tokens |
| `preview/` | Contact sheet of the whole pack |

## Using them

- **Scale by whole numbers only** (2×, 3×, 4×) with `image-rendering: pixelated` in CSS, or `imageSmoothingEnabled = false` on canvas.
- **Players are layered.** Draw in this order: body → shirt → shorts → socks → boots → hair → (GK gloves). Built in canvas, this gives 5 skins × 8 hair styles × 6 hair colours × kits from a few dozen files.
- **Templates use key colours.** In `*_template.png` files, `#ff0000` is the primary colour and `#00ff00` the secondary. Swap them for the club's colours on a small offscreen canvas, then cache the result.
- **9-slice:** buttons have 4px insets, panels/slots/bars 3px. In CSS: `border-image: url(button_yellow_9slice.png) 4 fill / 12px; image-rendering: pixelated;`.
- **Card layout:** the portrait window starts at (4,12) and is 40×28. The name and rating go below the line at y=43. The rarity label is baked into the top band.
- **Animation timings:** player idle 2 frames at 400ms, pack rip 4 frames at 80ms, ball spin 4 frames at 60ms, sparkle 4 frames at 90ms.
- **Audio:** convert to `.m4a`/`.ogg` for the app build (e.g. `ffmpeg -i x.wav -c:a aac x.m4a`). The notification sound needs `.caf` on iOS and `.ogg`/`.wav` in `res/raw` on Android.

## Not included

- **Fonts.** The prototype uses Press Start 2P and VT323, both free under the SIL Open Font License. Download them from Google Fonts and bundle them in the app (don't load them from a CDN).
- **Final music.** The loop is a placeholder to test the feel.
- **Larger character art**, e.g. a bigger portrait for card reveals. This is the first thing to commission or hand-draw if you want more polish than the 12×16 sprites.

## Regenerating

`gen.py` (sent alongside this pack) rebuilds everything from code. Change the palette, glyphs or grids and run `python3 gen.py`. It needs Pillow and NumPy.

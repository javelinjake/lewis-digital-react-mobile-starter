# What was checked

Completed 2 October 2026. This document records the evidence and the limits of the proposal.

## Source and current app

Read the actual React app's navigation, home, welcome/registration/verification/auth, workout discovery/detail/session/timer/completion, journal, family, settings, content adapters and activity logging. Also inspected the existing native exports and offline outbox API. The main product proposal maps findings to source paths.

Rendered the current app locally in Chromium with fictional Directus API responses for home, journal and family. The workout/recipe names are fixtures based on existing repository E2E examples, not a live catalogue assessment. Screenshots are marked as fixtures in the gallery. No production backend data was fetched or altered.

## Working prototype

[verify-prototype.mjs](verify-prototype.mjs) passed **31 browser checks**. Exact output is saved in [prototype-checks.json](prototype-checks.json):

- Default/time/setting suggestions, alternative selection and seated instructions.
- Step progression and early completion.
- Same-day additional attempts retaining memories without adding another participating day.
- Optional text treated as text, including an HTML-like input.
- Studio previews not mutating the fictional family's records.
- Empty-week/no-fit recovery and saved-idea filtering.
- Explicit simulated pending-sync state.
- Adult pack interest and free preview; no purchase or external message.
- Trail/sticker state, timer progress/pause/reset.
- Both demo override and OS reduced motion suppressing decorative Web Animations API effects.
- No horizontal overflow at 320, 390 and 720px widths.
- A text-size stress check at 390px without horizontal overflow.
- No prototype JavaScript errors during the exercised flows.

Inspected screenshots visually for composition and instruction legibility. Desktop/mobile studio captures and six mobile screen captures are in [assets](assets/). The studio uses copied existing font files and local images, and can open as a standalone HTML file without a build step or external scripts.

## Example code

The reference selector and React trail/stamp components passed strict TypeScript checking:

```sh
node_modules/.bin/tsc --noEmit --strict --jsx react-jsx --module ESNext \
  --moduleResolution Bundler --target ES2022 --lib ES2022,DOM --skipLibCheck \
  docs/family-experience-2026-10/examples/choose-idea.ts \
  docs/family-experience-2026-10/examples/SharedTrail.tsx
```

The eight reference algorithm assertions passed:

```sh
node --import tsx docs/family-experience-2026-10/examples/check-examples.ts
```

They cover hard constraints, deterministic ordering, recent-item preference, finite rotation, invalid rotation, no-match/empty inputs, and duplicate-operation/same-date/week-boundary aggregation. These assertions do not verify timezone conversion: the example explicitly consumes canonical dates supplied by a future household service.

No app production source or shared package was edited; a full production build/test run is not evidence for this isolated documentation prototype and was not claimed.

## Design provenance

Two original UI concept boards were generated with the built-in imagegen tool, inspected and saved in this project's assets folder. [image-prompts.json](image-prompts.json) contains the exact prompts. Their UI art is illustrative; the screenshot gallery is the reference for the implemented prototype. The prototype fox is an original small inline SVG, and other activity thumbnails use system emoji for the experiment. Final production art needs its own consistency/content review.

## Still unverified

- No live usage analytics or interviews; retention causes and benefit are hypotheses.
- No tested production household schema, account migrations, sync endpoint, reward transaction or entitlement system.
- Pending sync in the studio is a labelled simulation, not actual durable storage or a working offline backend.
- No actual payments; pack price and school pricing are proposed tests. Platform billing requirements and deductions must be checked during implementation.
- No verified minutes of physical exercise or health outcomes. Cooking/chat are tracked separately in the proposed metrics.
- No complete security/accessibility/legal audit. Manual VoiceOver, native device, real text zoom, low-end performance and content-suitability review remain necessary.
- Reference snippets are compile-checked examples and an integration guide, not installed production features.

## Run the artifacts

Open [prototype.html](prototype.html) or [design-gallery.html](design-gallery.html) directly in a browser. A server is optional for the studio; it is useful when running browser checks:

```sh
# From this documentation folder; serves only on the local computer.
python3 -m http.server 4387 --bind 127.0.0.1
```

Then from the app directory:

```sh
node docs/family-experience-2026-10/verify-prototype.mjs
```

The check script uses the already-installed app Playwright dependency and writes screenshots plus its report back into this folder. A different serving URL can be supplied through `PROTOTYPE_URL`.

`capture-current-app.mjs` requires the existing app's Vite server on 127.0.0.1:5179 with `VITE_DIRECTUS_URL=http://localhost:8055` and `VITE_FRONTEND_URL=http://localhost:5179`; the script intercepts localhost:8055 with fictional responses. It is for visual source comparison, not a production API test.

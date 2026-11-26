# Live updates (OTA)

A live update replaces the app's **web bundle** (JavaScript, CSS, HTML, images) on phones that already have the app, without a store release. It cannot change anything native: plugins, permissions, `capacitor.config`, icons, the app name. Those always need a store build with a new `version`.

It is built on `@capgo/capacitor-updater`, self-hosted:

- **Bundles** are zips on Vercel Blob (a CDN).
- **The app's own api** decides which bundle each device gets (`POST /api/ota/check`).
- **Nothing** goes to Capgo's cloud: no checks, no stats.

## How it decides

- A bundle is offered only to installed apps with the **same store version** (`package.json` `version`) and the same bundle id. A bundle never reaches a shell that lacks the plugins it was built against.
- A version under store review has **no bundles** until you publish one, so reviewers always see the submitted build. Publish live updates for a version only after it is live in the stores.
- Devices check in the background, download, and switch the next time the app is backgrounded. Nobody sees an "updating" screen. Apple asks that the app never says it is updating, so keep it that way.
- Each launch of a new bundle must reach `markAppReady()` within 10 seconds. The template calls it when the first screen is up. If it doesn't, the updater marks the bundle broken and goes back to the last good one.
- Untick **Active** on a bundle in the api's admin (System > App bundles) and devices on it go back to the previous active bundle, or to the store one.

## Turning it on (once per app)

1. `app.meta.ts`: set `capabilities.ota: true`. Add `"@capgo/capacitor-updater": "catalog:"` to the app's `package.json` and run `pnpm install`.
2. `APP_ENV=dev pnpm native:configure`, then `pnpm exec cap sync`. Commit.
3. **The api**: set `OTA_PUBLISH_SECRET` on its Vercel project. Make it with `openssl rand -base64 32`.
4. **Storage**: in Vercel > Storage, create a Blob store (public) and connect it to any project. Copy its `BLOB_READ_WRITE_TOKEN`.
5. Ship a **store build** with the updater in it (`pnpm release:ios` / `release:android`). Only installs of that build can take live updates.

## Publishing an update

In your shell (not committed):

```bash
export OTA_PUBLISH_SECRET=...           # same value as on the api
export BLOB_READ_WRITE_TOKEN=...
```

Then from the repo:

```bash
pnpm --filter @ld/app-<slug> ota:publish               # prod
APP_ENV=staging pnpm --filter @ld/app-<slug> ota:publish
```

It builds the native bundle against that environment's api, zips it, uploads it and records it. It prints the release (`version+build`) and how to roll back. Try it on staging first.

## Rules of thumb

- **Use it for** bug fixes, copy, styling, and small changes to screens that already exist.
- **Don't use it for** new features that change what the app is. Ship those through review: Apple allows interpreted code updates only when they don't change the app's main purpose.
- **Changed anything native?** Bump `version` and do a store release. `ota:publish` builds against the current `version`, and any shell on it gets the bundle, so a bundle that needs a plugin the shell lacks will fail to start and roll back.
- **Keep the api backwards compatible**: phones on older bundles stay in use for weeks.

## Not included

- **Signed bundles.** The plugin can verify a bundle against a key pair (Capgo encryption, `publicKey` in the config and their CLI to sign). Today integrity rests on HTTPS, an immutable Blob URL and the SHA-256 the api returns. Add signing if the api or the Blob store could be written to by someone else.
- **Channels and percentage rollouts.** Every device on a version gets the newest active bundle. To test first, publish to the staging app.

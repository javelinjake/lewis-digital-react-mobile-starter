# zactiv-family: rebuild brief

The Directus-era app was removed from `main` in the Payload platform change. It is recoverable at the git tag
`archive/zactiv-family-directus`:

```bash
git show archive/zactiv-family-directus:apps/zactiv-family/package.json
git worktree add ../zactiv-family-old archive/zactiv-family-directus
```

It will be rebuilt later on the new template (`apps/template`) with its own Payload backend. The product and
engineering spec for the rebuild is `family-experience-2026-10/ENGINEERING.md` in this folder.

## Do not carry these over

These were found when the app was reviewed. The new template removes the underlying causes, but check each one when
rebuilding.

| Problem in the old app | Where | Replacement in the new stack |
| --- | --- | --- |
| `VITE_DIRECTUS_SERVER_TOKEN` set in a local `.env`. Any `VITE_` value is bundled into the client the moment code reads it. | `.env` (gitignored) | The architecture check fails on `VITE_*` names containing SECRET, TOKEN, PASSWORD or PRIVATE. **Rotate this token in Directus now** if it was ever a real one. |
| Email and password stored base64-encoded in `localStorage` between registration and email verification. | `src/lib/family-data.ts` (`zactiv_pending_credentials`) | Verification links open the app, so the credentials never need to be held. |
| Auth tokens in a JavaScript-readable cookie (`directus-data`) on the web. | `src/lib/platform/web-token-storage.ts` | Web uses an httpOnly session cookie; native uses Keychain or Keystore. |
| `?access_token=` appended to asset URLs. | `src/lib/assets.ts` | Owner media is served through an authenticated route. |
| `logs_event` queried without a user filter. | `src/lib/activity-log.ts` | Every user-data collection is an `ownedCollection`, which filters by owner on the server. |
| Writes sent straight to the API with no outbox, and state kept in `localStorage`. | `src/lib/activity-log.ts`, `family-data.ts` | Offline writes go through `@ld/offline`. State comes from the persisted query cache. |

## Product needs the template does not cover yet

- A household or group scope (`ownedCollection({ scope: 'group' })`), for the shared family trail.
- Entitlements for paid packs (the shared RevenueCat webhook covers this).
- The editorial content collections (`pages`, `recipes`, `videos`, `workouts`, `school`) as public-data
  collections in the new backend.

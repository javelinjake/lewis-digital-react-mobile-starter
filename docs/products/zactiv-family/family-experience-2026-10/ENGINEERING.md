# Implementation specification

Read with [the product proposal](README.md). This is a proposed implementation, not an applied migration. The isolated [prototype](prototype.html) deliberately has no authentication, backend writes or billing.

## Architecture and boundaries

Keep changes app-local. Pages compose features; features use app services and shared packages. Reuse the current Directus client, React Query, Zustand session state, UI components and native wrappers. Follow the repo's DaisyUI-only production UI rule. Do not introduce a parallel UI kit or a new global motion framework.

Suggested new app modules:

```text
src/pages/TodayPage.tsx, IdeasPage.tsx, MomentPage.tsx, OurFamilyPage.tsx
src/features/today/TodayScreen.tsx, choose-idea.ts
src/features/moments/MomentScreen.tsx, MomentCompleteScreen.tsx, SharedTrail.tsx
src/features/family/OurFamilyScreen.tsx
src/lib/household-api.ts, moment-api.ts, use-moments.ts
src/lib/moment-outbox.ts
src/assets/moments.css
```

Preserve `/workouts/:id`, `/recipes/:id` and `/videos/:id` deep links. Fold their discovery into Ideas before removing old tabs. Keep public CMS slugs functioning: order new explicit routes before `/:slug`. A public sample must bypass `RequireAuth` intentionally, with a narrowly permitted public content API. Private journal and household routes remain guarded.

TanStack Query owns household records, activities, history and sync results. Zustand owns the authenticated session and temporary UI choices. Durable writes use `@ld/offline`'s outbox only, never another localStorage mutation queue or persisted TanStack mutations. `@ld/native` handles network hints/haptics/credentials. Apps must not read `navigator.onLine`, register service workers or import Capacitor plugins directly.

The app currently lacks `@ld/offline` in its package manifest. Add the workspace dependency when implementing this feature. Confirm cache persistence architecture before promising full offline app launches: `App.tsx` currently restores auth with a live refresh, and its QueryClient has no visible persistent-cache provider. PWA presence does not by itself make authentication, private data or writes work offline.

## Minimal data model

Do not start with individual child accounts. A household has an adult owner; a second adult invitation is a separate later increment. Family members can initially be optional display names and roles, not full identity records.

| Proposed collection | Fields and constraints | Purpose |
|---|---|---|
| `family_households` | UUID id; owner relation; display_name; IANA timezone; created_at | One shared record. Initially one household per adult owner. |
| `family_household_adults` | household; user; role; unique household/user | Add when multi-adult access is implemented, not before the MVP needs it. |
| `family_ideas` | UUID id; status; title; kind `move/make/chat`; minutes; setting; kit; suitable age bands; steps JSON; seated_steps JSON; safety_notes; illustration; editorial_order; is_public_sample; pack relation nullable; content_version | Short authored scripts. Store only reviewed published versions. |
| `family_moments` | UUID id/client operation ID; household; idea; idea_version; attempted_at UTC; household_local_date; created_by; actual_seconds nullable; feedback `again/not_for_us` nullable; sync/server timestamp | One intentional attempt. Operation ID unique; authenticated household access. |
| `family_memories` | moment unique; private optional text; updated_at; revision | Optional notes, separate from behavioural analytics. Keep exported history understandable if content later changes. |
| `family_favourites` | household; idea; unique pair | Explicit preferences without profiling children. |
| `family_entitlements` (paid phase only) | household; product; source; provider_reference unique; starts_at; ends_at nullable; state | Server-validated access. No client boolean granting paid access. |

The collection names are proposals and must be checked against the live schema before migration. Existing activity logs may be retained; do not blindly create another logging system alongside them. Decide whether to extend `logs` with a stable operation ID/household/version or add a dedicated moments collection with a migration mapping. Keep one canonical source of attempts and reward accounting. The old schema uses numeric activity IDs, so adapt content references explicitly rather than coercing all new IDs to numbers.

### Completion contract

`POST /family/moments` with a stable client-generated UUID:

```json
{
  "operationId": "UUID generated once at session start",
  "ideaId": "published idea UUID",
  "ideaVersion": 3,
  "attemptedAt": "2026-10-02T15:15:00.000Z",
  "actualSeconds": null,
  "feedback": null
}
```

The server derives the household from authenticated authorisation, validates access/content references and derives the local date with the household's stored timezone. Do not trust a posted owner ID or paid flag. Accept an honest shortened attempt; elapsed time is optional, not evidence of exercise. Use server transaction/uniqueness for creation and any reward ledger update. Retry with the same operation ID returns the existing result. Same ID with different immutable content returns a conflict, not another reward.

Return canonical moment, the counted household date, accepted reward state if applicable, and server timestamp. A network failure after server acceptance must be safe to replay. Reward/credit issuance is a backend responsibility; the UI never computes spendable Zactivs. A unique operation ID prevents accidental repeats; any real-world voucher system would also need abuse controls and its own cost model. It is deferred here.

One weekly marker per **participating local date**, regardless of number/type of moments that day. Cooking and chat qualify as connection moments but analytics distinguish `kind`; do not interpret the trail as measured physical activity. A household can replay ideas unlimited times. Trail view caps at three, while memories are unbounded and exportable.

Define week as Monday 00:00 through the following Monday in the household's IANA timezone. Use timezone-aware date utilities, not an assumed UTC offset. DST, a delayed offline sync, Sunday-to-Monday rollover and travel must not move a past attempt into the wrong week. Store the canonical local date on acceptance; timezone changes apply prospectively. A suspicious/far-future timestamp should be rejected or held for correction, not silently credited.

## Offline and sync states

An offline-capable loop needs three distinct layers: accessible cached instructions, restored usable session context, and durable completion writes. Handle all three explicitly.

| State | Family-facing copy | Behaviour |
|---|---|---|
| Content pending with cache | “Your saved ideas” | Render last approved cached instructions; no spinner blocks them. |
| Content pending without cache | “Finding an idea…” | Compact loading state and public bundled sample if available. |
| No suitable match | “No idea fits just now. Try another time or setting.” | Do not choose inaccessible or equipment-heavy content silently. |
| Durable local completion, sync pending | “Saved on this device. We'll sync when we can.” | Show tentative marker; retain operation through restart. No confirmed currency yet. |
| Synced | “Saved to your family” | Merge canonical moment by operation ID; no second animation. |
| Auth hold | “Saved here. Sign in to sync your family.” | Keep operation scoped to original user/project; don't replay under another adult. |
| Storage failure before queue write | “We couldn't save this on this device. Try again.” | Keep attempt ID in memory and offer retry; no “saved” claim. |
| Permanent permission/content failure | “This moment couldn't be synced. Try again or contact us.” | Surface a recoverable state; do not lose the explanation or award currency. |

Use `createOutbox` with `scopeStorageKey('outbox', projectId, userId)` and IndexedDB/native-compatible storage via existing adapters. Register a handler in app setup, enqueue before attempting online delivery using `runOrQueue`, and flush on existing connection/resume mechanisms. The repository outbox returns `'sent'` or `'queued'`, holds auth failures and drops non-retryable failures; inspect that behaviour when implementing an error UI. Explicitly prevent an immediate send and background flush from racing locally, and retain server idempotency as the final guard.

Do not put private family records in an unscoped global cache. Remove/detach subscriptions on logout and switch cache scope before showing another account. Account deletion must clear household-specific cache/outbox according to the chosen recovery/deletion policy. Logout should tell an adult about pending unsynced attempts before destructive removal if the policy clears them. The proposal does not promise native encrypted storage for all journal text: assess and document storage separately.

## Selection algorithm

A rules-based selector is sufficient. Start with human-edited metadata and scripts.

1. Filter published, accessible content by time, setting, available equipment, entitlements and required adaptations.
2. Prefer an explicitly unfinished session with valid content/access before selecting a new idea. Resume by concrete activity type, ID and session route, not by a generic latest-log flag.
3. Prefer the selected type if the parent asked for Move/Make/Chat. Default Today picks short Move play.
4. Prefer not recently attempted where equally suitable; permit repeats when the catalogue is thin.
5. Use editorial priority as the tie-breaker and a stable ID for deterministic behaviour. Rotate only when asked or at a planned editorial refresh.
6. Empty result stays empty. Offer to widen the constraints. No opaque recommendation engine or child profiling required.

[The standalone TypeScript selector](examples/choose-idea.ts) implements a bounded version with hard constraint filtering and a finite Try another rotation. It intentionally does not implement backend state, age appropriateness review or entitlements.

## Instrumentation that answers a product question

The north-star candidate is **households with attempted Move activities on two or more distinct local dates in a rolling seven-day window**. Also report all-kind family moments separately, because cooking/chat are valuable without establishing physical activity. Both are self-reported attempts, not verified minutes of exercise.

| Event | Essential properties | Question answered |
|---|---|---|
| `idea_impression` | pseudonymous adult/household or guest session; idea/version; placement; experiment variant; time/setting | Did a useful suggestion actually appear? Emit once per visible card per visit, not every rerender. |
| `idea_swap` | from/to idea; reason optional enum | Is the default unsuitable or does choice help? |
| `moment_start` | operation ID; idea/version; type; public/account source | How often does viewing lead to trying? |
| `moment_attempt` | operation ID; type; local date; sync state | Did the family report an attempt? Deduplicate locally and on server. |
| `moment_sync` | operation ID; accepted/held/rejected | Are lost writes undermining the loop? |
| `idea_feedback` | idea/version; again/not_for_us; optional reason enum | Which scripts earn repeat use? |
| `pack_preview` | pack; price variant; adult-facing placement | Is the offer relevant? |
| `purchase_confirmed` (paid phase) | verified order reference; household; product | Does intent translate to paid demand? |

Never send names, email addresses, journal text, note content, child age/DOB or exact location as analytics properties. Keep the minimum useful pseudonymous adult/household identifiers with a documented lawful basis and retention policy. Guest-to-adult linking should be explicit when saving, rather than fingerprinting. Provide an opt-out appropriate to the analytics implementation. Separate operational sync events from product analytics.

Activation denominator: all opted-in invited households in the pilot, not only those who opened home. First-use start conversion: unique sessions that started divided by unique sessions with a visible suggestion, separately for guests and adults. Repeat use: activated households with attempts on at least two distinct dates during days 8–14, divided by all activated households with a complete 14-day observation window. Compare timezone-consistent household dates. Report fully observed cohorts, loss to follow-up, sample counts and survey response rate. Do not attribute churn solely to app UI without qualitative evidence.

## Incremental build plan

| Increment | App-local work | Exit criteria |
|---|---|---|
| 0: trust and baseline | Remove registration password localStorage path and clear legacy key; use sign-in after verification. Add bounded funnel events; inspect production CMS content. | No password written in registration/verification; old key removed; no private notes in analytics. Baseline measurable without changing all screens. |
| 1: useful starting point | Curated Today, time/setting selector, public bundled/sample idea, safe loading/empty states. Retain old content links. | A new visitor can try an idea before registration; no private CMS access is granted. Start action visible at narrow widths/large text. |
| 2: short family session | Step instructions, seated variant, optional timer; completion contract; outbox persistence; usable offline cached session. | Attempt survives restart; repeated tap/retry results in one canonical moment/reward. No claiming save before persistence succeeds. |
| 3: shared recognition | Household trail and memory queries, three destinations, save favourites, optional note, migration path for current journal/profile. | Records consistent across devices for an adult; local-date aggregation correct; existing records not silently discarded. |
| 4: pilot iteration | Copy/content refresh and one requested reminder if evidence supports it. | Reminder preference maps to actual scheduling; clear opt-in/off; no reminders required for core functionality. |
| 5: revenue experiment | Public preview of one authored pack; interest test first, actual purchases after verified billing integration. | Transparent adult purchase flow; household entitlement restored after reinstall; cancellations/refunds handled; free promise intact. |

Rough engineering effort for increments 0–3: 10–18 development days plus content/design review, assuming Directus extension access and existing storage infrastructure can be reused. Offline auth, data migration or native purchase integration can expand scope. Break estimates down after verifying the backend and existing production data. Do not treat a static prototype as eliminating these dependencies.

## Acceptance and meaningful verification

**Product/interaction**

- Default suggestion and Start fit at 390px width; at 320px and text zoom, no horizontal overflow or hidden action.
- Changing time/setting never returns an activity that violates those constraints. Try another cycles a finite eligible set; no slot-machine animation.
- A seated option exposes actual instructions, not just a changed icon.
- Parent can finish early or leave any session. Timer/audio/video are optional; no camera evidence is required.
- Completion offers honest negative feedback. A note is optional and requires no extra form to leave.
- Previewing a celebration in the design studio has no effect on the fictional family record; production has no such preview control.

**Data and reliability**

- Finish tap twice, reload during response, concurrent retry, and timeout after server acceptance all create one moment and at most one reward entry.
- Multiple real attempts on one local date create multiple memories and one trail marker.
- An offline attempt survives app/browser restart and syncs to the same household; a new signed-in account never receives it.
- Auth hold, permission rejection, storage quota failure and deleted content are visible and recoverable.
- Two devices show the same canonical trail and notes after refresh; note conflicts follow a documented revision policy.
- Monday rollover and UK DST boundary tests preserve counted dates; delayed Sunday sync does not count on Monday.
- Removing persistent registration credentials is verified independently of the engagement changes.

**Accessibility and performance**

- Keyboard focus and screen-reader order follow the action sequence; every button has a clear name and selected state.
- Reduced-motion OS preference and in-session preference change suppress transforms and decorative animation while keeping progress text current.
- Trail has an accessible label; feedback uses text/pressed state; timer does not announce every second, only state changes.
- 200% zoom and 320px viewport checked. Contrast checked for actual foreground/background pairs. Manual VoiceOver and real iOS/Android checks remain necessary.
- Avoid external animation dependency for MVP; no autoplay asset downloads. Test representative low-end hardware and slow network before launch.

**Paid phase**

- Free activities and history remain usable after payment failure, cancellation and refund.
- Purchase/restore cannot be forged via local UI state; account and household transfers have explicit rules.
- Pack content, price, household licence, duration and renewal terms match the product sold.

The prototype verification covers only the isolated UI and examples. Production backend, offline persistence, payments and native behaviour remain to be built and tested.

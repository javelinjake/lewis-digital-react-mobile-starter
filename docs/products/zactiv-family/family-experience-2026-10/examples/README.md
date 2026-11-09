# Code examples

These are compile-checked reference files outside `src/`. They are not imported by the shipped application.

- [choose-idea.ts](choose-idea.ts): deterministic hard-constraint filtering, bounded rotation, repeated-date/operation aggregation. The caller must prefilter access, age suitability and paid entitlements. Local dates must come from the timezone-aware household service.
- [SharedTrail.tsx](SharedTrail.tsx): accessible React trail and one-shot Web Animations API stamp, reduced-motion support and cleanup. Uses current app colour values and Tailwind-style classes. Import into an app feature only after integrating query and sync state.
- [moments.css](moments.css): restrained card entry and press feedback, with OS/in-app motion controls.

## Example selection

```tsx
const idea = chooseIdea(reviewedAccessibleIdeas, {
  minutes: 5,
  setting: 'indoors',
  availableKit: ['none'],
  seatedRequired: true,
  kind: 'move',
  recentIdeaIds: completedMoments.slice(0, 3).map(moment => moment.ideaId),
}, alternativeIndex)

// Reset alternativeIndex when the parent changes a hard constraint.
// Retain one stable result during an interaction; don't re-randomise on render.
if (!idea)
  return <EmptyIdeas onWidenConstraints={openTimeAndSetting} />
```

This snippet describes composition; `EmptyIdeas`, query hooks and content access filtering must be implemented app-locally using the existing UI components/DaisyUI. Keep the card title and instructions in HTML, independent of an illustration.

## Durable completion integration

The existing `@ld/offline` API was inspected. This is an integration sketch because the household endpoint does not yet exist:

```ts
import { runOrQueue } from '@ld/offline'

// Generate and retain this ID once at session start, not on each retry.
const operationId = crypto.randomUUID()
const payload = { operationId, ideaId, ideaVersion, attemptedAt: new Date().toISOString() }

// Register at app/session setup. The server must enforce operationId uniqueness.
outbox.register('family.moment.complete', async (pending) => {
  await postMoment(pending)
})

// Persist before the first request. Disable repeated taps while pending.
const state = await runOrQueue(outbox, 'family.moment.complete', payload, operationId, postMoment)
setSaveState(state === 'sent' ? 'synced' : 'saved-on-device')
```

Implement `postMoment`, scoped outbox creation, flush/subscription lifecycle, storage errors and held/rejected UI as specified in [ENGINEERING.md](../ENGINEERING.md). Do not replace this with `localStorage.setItem('pending', ...)`; the outbox is the repository's only durable write queue. Do not claim confirmed Zactivs for a queued write. Read the existing package API for exact registration/payload types when implementing.

The React examples skip decorative transforms for reduced motion, cancel active animations on unmount, and keep the accessible progress label independent of animation. The prototype also shows a deadline-based timer: compute remaining seconds from a deadline rather than counting interval ticks, so a suspended tab does not stretch a turn. A production native session needs resume handling and real-device verification.

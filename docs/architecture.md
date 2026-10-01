# Architecture

Feature-first apps. Shared mechanisms live in `packages/*`.

## Routing

Data router only: `createBrowserRouter` and `RouterProvider`. Nested layouts are the shells (`tabs`, `stack`, `auth`, `blank`). Route `handle` carries `title`. The app bar reads it with `useMatches`.

Do not add route loaders or actions for API data. Reads and writes go through TanStack Query. Auth guards are layout components that read Zustand session status.

## Data

API functions in `features/<feature>/api` are plain async functions. Queries and mutations live beside them.

Outbox mutations spread `outboxMutationDefaults` (`networkMode: 'always'`, `retry: false`). `runOrQueue` persists the operation before the request, including when the device is online. A queued result means saved on this device. Only a confirmed server result removes the item.

Register handlers during startup, before `flush`. Handlers must be idempotent. Items carry a caller-supplied id, `userId`, and `projectId`.

A 401 holds the item for that user. It is not dropped and it is not replayed as another account. Logout leaves the queue parked under that user id. Discarding it requires an explicit confirm.

## Cache

`PersistQueryClientProvider` restores the IndexedDB query cache. `gcTime` matches the 24 hour `maxAge`. Mutations are not dehydrated (`shouldDehydrateMutation` returns false).

Keys:

- `ld:query-cache:v1:{projectId}:{userId}`
- `ld:outbox:v1:{projectId}:{userId}`

Pending rows are rebuilt from the outbox after restore. The query cache does not decide whether an unsent write survived.

## Boundaries

`pages` and `routes` may import features. Features may not import each other. Shared folders may not import features or pages. `src/app` may register outbox handlers.

`@ld/offline` does not import React, Directus, or Capacitor. The TanStack adapter is `@ld/react-utils/query`.

Pages should stay small. The architecture check enforces 500 lines, not the 50-line page guide.

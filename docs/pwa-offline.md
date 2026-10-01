# PWA and offline

`VITE_BUILD_TARGET=web` enables Vite PWA with `registerType: 'prompt'` and `injectRegister: false`. `@ld/pwa` registers the worker. The native build omits the plugin and aliases `virtual:pwa-register` to a stub.

The update prompt refuses to reload while the outbox has pending items or a form is dirty.

## Outbox

`runOrQueue` writes the operation to IndexedDB before attempting the network, then returns `'queued'` or `'sent'`. TanStack Query must not pause that function: outbox mutations use `networkMode: 'always'` and `retry: false`. Query persistence sets `shouldDehydrateMutation` to false so TanStack's own mutation queue is not a second outbox.

Startup order: register handlers, wait until the outbox is restored, release auth holds for the signed-in user, rebuild pending rows, then flush.

Storage is scoped by project and user and versioned (`v1`). A different version is parked and not replayed. Logout does not delete another account's queue. A 401 keeps the item on the owning user.

The notes demo upserts by the client id, so a replay does not create a second row.

## Reads

Reads use TanStack Query with `networkMode: 'offlineFirst'` and a 24 hour `gcTime`. The persister `maxAge` is the same length. Screens render cached notes, pending outbox rows, or an empty/error state.

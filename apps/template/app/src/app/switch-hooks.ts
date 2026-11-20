/**
 * A guest who creates an account signs in to it, and the guest user is then merged away by the server. Writes still
 * queued under the guest would never be sent. The session scope registers a hook here so the store can flush them first.
 */
let beforeUserSwitch: () => Promise<void> = async () => {}

export function setBeforeUserSwitch(hook: () => Promise<void>) {
  beforeUserSwitch = hook
}

export function runBeforeUserSwitch() {
  return beforeUserSwitch().catch(() => undefined)
}

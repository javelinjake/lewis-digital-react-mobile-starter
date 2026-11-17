import { impact, notification } from '@ld/native'

let enabled = true

/** Short vibration feedback. Off when the player turns vibration off. */
export const haptics = {
  setEnabled(on: boolean): void {
    enabled = on
  },
  light: () => (enabled ? void impact('light') : undefined),
  medium: () => (enabled ? void impact('medium') : undefined),
  heavy: () => (enabled ? void impact('heavy') : undefined),
  success: () => (enabled ? void notification('success') : undefined),
  warning: () => (enabled ? void notification('warning') : undefined),
}

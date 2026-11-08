/**
 * The policy for local notifications, with no Capacitor in it so it can be tested.
 * An app describes what it would like to say and when (`NotificationPlan`). This decides what is actually sent:
 * nothing in the past, nothing the person switched off, nothing in quiet hours (moved to the morning instead),
 * and no more than `maxPerDay` on any one day.
 */
export interface NotificationPlan {
  /** Stable id for this alert, so rescheduling replaces it instead of stacking a second one. */
  id: number
  /** Which switch in Settings controls it, e.g. `shelf-full`. */
  type: string
  /** When to show it, as epoch milliseconds. */
  at: number
  title: string
  body: string
}

export interface NotificationPolicy {
  /** Local hours `[from, to)` with no alerts. `[22, 8]` means 22:00 until 08:00. */
  quietHours?: [number, number]
  /** Most alerts on one local calendar day. */
  maxPerDay?: number
  /** Types the person has left on. Anything else is dropped. Omit to allow every type. */
  enabledTypes?: readonly string[]
  now?: number
}

export const DEFAULT_QUIET_HOURS: [number, number] = [22, 8]
export const DEFAULT_MAX_PER_DAY = 3

function inQuietHours(hour: number, [from, to]: [number, number]) {
  return from === to ? false : from < to ? hour >= from && hour < to : hour >= from || hour < to
}

/** The first moment at or after `at` that is outside quiet hours: the morning the quiet window ends. */
function endOfQuietHours(at: number, quiet: [number, number]) {
  const date = new Date(at)
  const hour = date.getHours()
  // After the evening start (22:00-23:59) the window ends tomorrow morning. In the early hours it ends today.
  const eveningPart = quiet[0] > quiet[1] && hour >= quiet[0]
  const morning = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (eveningPart ? 1 : 0), quiet[1], 0, 0, 0)
  return morning.getTime()
}

function dayKey(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function planNotifications(plans: readonly NotificationPlan[], policy: NotificationPolicy = {}): NotificationPlan[] {
  const quiet = policy.quietHours ?? DEFAULT_QUIET_HOURS
  const maxPerDay = policy.maxPerDay ?? DEFAULT_MAX_PER_DAY
  const now = policy.now ?? Date.now()
  const enabled = policy.enabledTypes ? new Set(policy.enabledTypes) : undefined

  const moved = plans
    .filter(plan => plan.at > now && (!enabled || enabled.has(plan.type)))
    .map(plan => (inQuietHours(new Date(plan.at).getHours(), quiet) ? { ...plan, at: endOfQuietHours(plan.at, quiet) } : plan))
    .sort((a, b) => a.at - b.at)

  const perDay = new Map<string, number>()
  return moved.filter((plan) => {
    const key = dayKey(plan.at)
    const count = perDay.get(key) ?? 0
    if (count >= maxPerDay)
      return false
    perDay.set(key, count + 1)
    return true
  })
}

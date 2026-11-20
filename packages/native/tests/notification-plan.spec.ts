import { describe, expect, it } from 'vitest'
import { planNotifications } from '../src/notification-plan'

// Local-time dates, so the tests mean the same thing in every timezone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const plan = (id: number, type: string, when: number) => ({ id, type, at: when, title: type, body: type })
const now = at(8, 12)

describe('planNotifications', () => {
  it('keeps alerts in the future and drops the ones already due', () => {
    const result = planNotifications([plan(1, 'a', at(8, 11)), plan(2, 'a', at(8, 13))], { now })
    expect(result.map(item => item.id)).toEqual([2])
  })

  it('drops types the person switched off, and allows everything when no list is given', () => {
    const plans = [plan(1, 'shelf-full', at(8, 14)), plan(2, 'full-time', at(8, 15))]
    expect(planNotifications(plans, { now, enabledTypes: ['full-time'] }).map(item => item.id)).toEqual([2])
    expect(planNotifications(plans, { now }).map(item => item.id)).toEqual([1, 2])
  })

  it('moves an alert that lands in quiet hours to the morning, not into the night', () => {
    const [late] = planNotifications([plan(1, 'a', at(8, 23, 30))], { now })
    const [early] = planNotifications([plan(2, 'a', at(9, 3))], { now })
    expect(late.at).toBe(at(9, 8))
    expect(early.at).toBe(at(9, 8))
  })

  it('allows 22:00 itself to be quiet and 08:00 to be open', () => {
    expect(planNotifications([plan(1, 'a', at(8, 22))], { now })[0].at).toBe(at(9, 8))
    expect(planNotifications([plan(1, 'a', at(8, 8, 0))], { now: at(8, 7) })[0].at).toBe(at(8, 8))
    expect(planNotifications([plan(1, 'a', at(8, 21, 59))], { now })[0].at).toBe(at(8, 21, 59))
  })

  it('sends at most three a day, keeping the earliest', () => {
    const plans = [10, 11, 12, 13, 14, 15].map((hour, index) => plan(index + 1, 'a', at(9, hour)))
    const result = planNotifications(plans, { now })
    expect(result.map(item => item.id)).toEqual([1, 2, 3])
  })

  it('counts each day separately, and counts moved alerts on the day they land', () => {
    const plans = [
      plan(1, 'a', at(9, 10)),
      plan(2, 'a', at(9, 11)),
      plan(3, 'a', at(9, 12)),
      // 23:00 on the 8th is moved to 08:00 on the 9th, so it joins a day that is already full.
      plan(4, 'a', at(8, 23)),
      plan(5, 'a', at(10, 10)),
    ]
    const ids = planNotifications(plans, { now }).map(item => item.id)
    expect(ids).toEqual([4, 1, 2, 5])
  })

  it('respects custom quiet hours that do not wrap midnight', () => {
    const [moved] = planNotifications([plan(1, 'a', at(9, 13))], { now, quietHours: [12, 14] })
    expect(moved.at).toBe(at(9, 14))
  })

  it('does not mutate what it is given', () => {
    const plans = [plan(1, 'a', at(8, 23))]
    planNotifications(plans, { now })
    expect(plans[0].at).toBe(at(8, 23))
  })
})

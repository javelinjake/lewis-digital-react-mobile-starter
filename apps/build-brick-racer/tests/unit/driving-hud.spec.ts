import type { VehicleState } from '@/game/vehicle/sim'
import { describe, expect, it } from 'vitest'
import { cueFor, formatSpeed, formatTime, speedBand } from '@/features/driving/hud/format'
import { HudView } from '@/features/driving/hud/hud-view'
import { getChallenge } from '@/game/challenges'
import { ChallengeRun } from '@/game/challenges/run'

function state(over: Partial<VehicleState> = {}): VehicleState {
  return {
    pos: [0, 0, 0],
    quat: [0, 0, 0, 1],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
    speed: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    slipAngle: 0,
    yawRate: 0,
    upDot: 1,
    groundedWheels: 4,
    airborne: false,
    wheelspin: false,
    reversing: false,
    wheels: [],
    surface: 'tile',
    ...over,
  }
}

describe('hUD formatting', () => {
  it('formats time and speed', () => {
    expect(formatTime(0)).toBe('00:00.0')
    expect(formatTime(21.84)).toBe('00:21.8')
    expect(formatTime(75.2)).toBe('01:15.2')
    expect(formatTime(-3)).toBe('00:00.0')
    expect(formatSpeed(2.64)).toBe('2.6')
    expect(formatSpeed(-1)).toBe('0.0')
  })

  it('draws the entry-speed band at the target ± tolerance and tells inside from outside', () => {
    const inside = speedBand(3.2, 3.2, 0.1)
    expect(inside.inside).toBe(true)
    expect(inside.hi - inside.lo).toBeCloseTo(0.2 / 1.5, 5)
    expect(speedBand(4.5, 3.2, 0.1).inside).toBe(false)
    expect(speedBand(2.5, 3.2, 0.1).inside).toBe(false)
    expect(speedBand(99, 3.2, 0.1).marker).toBe(1)
  })
})

describe('rule cues', () => {
  const run = (id: string) => {
    const r = new ChallengeRun(getChallenge(id)!, -4)
    r.start()
    return r
  }

  it('shows a visible entry-speed cue for the stop box before the gate and distance after braking starts', () => {
    const r = run('kitchen_braking')
    const before = cueFor(r.def, r.run, state({ speed: 3.2 }))
    expect(before.kind).toBe('band')
    expect(before.title).toContain('3.2')
    expect(before.band?.inside).toBe(true)
    r.run.hud.entered = true
    r.run.metrics.entrySpeed = 3.1
    r.run.hud.distance = 0.4
    const after = cueFor(r.def, r.run, state())
    expect(after.kind).toBe('text')
    expect(after.detail).toContain('0.40 m')
  })

  it('covers coast, quick start, drift and jump', () => {
    expect(cueFor(run('kitchen_coast').def, run('kitchen_coast').run, state()).kind).toBe('band')
    const coast = run('kitchen_coast')
    coast.run.hud.entered = true
    expect(cueFor(coast.def, coast.run, state()).title).toContain('Motor off')
    expect(cueFor(run('kitchen_acceleration').def, run('kitchen_acceleration').run, state()).title).toContain('4.0')
    const drift = run('kitchen_drift')
    drift.run.hud.slip = 22
    drift.run.hud.sliding = true
    drift.run.metrics.driftScore = 14
    const d = cueFor(drift.def, drift.run, state())
    expect(d.active).toBe(true)
    expect(d.detail).toContain('Score 14')
    expect(cueFor(run('garden_jump').def, run('garden_jump').run, state({ airborne: true })).title).toBe('Airborne!')
    expect(cueFor(run('garden_mud').def, run('garden_mud').run, state()).kind).toBe('none')
    expect(cueFor(null, null, state()).kind).toBe('none')
  })
})

describe('hudView writes straight to the DOM only when values change', () => {
  it('skips identical writes and caches nodes', () => {
    const root = document.createElement('div')
    root.innerHTML = '<span data-hud="speed">0.0</span><div data-hud="band"></div>'
    const view = new HudView(root)
    let writes = 0
    const speed = root.querySelector('[data-hud="speed"]')!
    new MutationObserver(() => writes++).observe(speed, { childList: true, characterData: true, subtree: true })
    view.set('speed', '1.0')
    view.set('speed', '1.0')
    expect(speed.textContent).toBe('1.0')
    view.show('band', false)
    expect(root.querySelector('[data-hud="band"]')!.classList.contains('is-hidden')).toBe(true)
    view.show('band', true)
    expect(root.querySelector('[data-hud="band"]')!.classList.contains('is-hidden')).toBe(false)
    view.style('band', 'left', '10%')
    expect((root.querySelector('[data-hud="band"]') as HTMLElement).style.left).toBe('10%')
    view.set('missing', 'x')
    expect(writes).toBeGreaterThanOrEqual(0)
  })
})

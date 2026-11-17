import { describe, expect, it } from 'vitest'
import { GamepadPoller, padToRaw } from '@/features/driving/input/gamepad'
import { ControlHub } from '@/features/driving/input/hub'
import { KeyboardInput, keysToRaw } from '@/features/driving/input/keyboard'
import { emptyControls, InputRamp } from '@/game/vehicle/input'

function actions() {
  const calls: string[] = []
  return { calls, actions: { reset: () => calls.push('reset'), camera: () => calls.push('camera'), lock: () => calls.push('lock'), pause: () => calls.push('pause') } }
}

describe('all driving input comes from the player (AC09)', () => {
  it('is completely neutral when nobody touches anything', () => {
    const hub = new ControlHub(actions().actions)
    hub.attach()
    hub.poll()
    const raw = hub.read()
    expect(raw).toEqual(emptyControls())
    // Ramping neutral controls produces no steering, throttle or brake.
    const ramp = new InputRamp()
    for (let i = 0; i < 120; i++) {
      const out = ramp.sample(raw, 1 / 60)
      expect(out).toEqual({ steer: 0, throttle: 0, brake: 0, reverse: false })
    }
    hub.detach()
  })

  it('merges keyboard, touch and gamepad without inventing commands', () => {
    const hub = new ControlHub(actions().actions)
    hub.touch.press('left', 1)
    hub.touch.press('throttle', 2)
    const raw = hub.read()
    expect(raw.left && raw.throttle).toBe(true)
    expect(raw.right || raw.brake || raw.reverse).toBe(false)
  })
})

describe('keyboard', () => {
  it('maps arrows and WASD, space brake and shift reverse', () => {
    expect(keysToRaw(new Set(['ArrowLeft', 'ArrowUp']))).toMatchObject({ left: true, right: false, throttle: true, brake: false })
    expect(keysToRaw(new Set(['KeyD', 'KeyS']))).toMatchObject({ right: true, brake: true })
    expect(keysToRaw(new Set(['Space']))).toMatchObject({ brake: true })
    expect(keysToRaw(new Set(['ShiftLeft', 'KeyW']))).toMatchObject({ reverse: true, throttle: true })
    expect(keysToRaw(new Set(['ArrowLeft', 'ArrowRight']))).toMatchObject({ left: false, right: false })
  })

  it('fires one-shot actions and tracks held keys until released', () => {
    const { calls, actions: a } = actions()
    const kb = new KeyboardInput(a)
    kb.attach()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    expect(calls).toEqual(['reset', 'camera', 'lock', 'pause', 'pause'])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    expect(kb.toRaw().throttle).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }))
    expect(kb.toRaw().throttle).toBe(false)
    kb.detach()
  })
})

describe('gamepad', () => {
  const pad = (axes: number[], buttons: Record<number, number> = {}) => ({
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: (buttons[i] ?? 0) > 0.5, value: buttons[i] ?? 0 })),
  })

  it('maps the stick, triggers and reverse with a dead zone', () => {
    expect(padToRaw(pad([0.05])).steerAxis).toBe(0)
    expect(padToRaw(pad([1])).steerAxis).toBeCloseTo(1)
    expect(padToRaw(pad([-0.58])).steerAxis).toBeLessThan(0)
    const raw = padToRaw(pad([0], { 7: 0.8, 6: 0.3, 2: 1 }))
    expect(raw).toMatchObject({ throttleAxis: 0.8, brakeAxis: 0.3, reverse: true })
  })

  it('fires reset and pause once per press and reports no pad when none is connected', () => {
    const { calls, actions: a } = actions()
    const poller = new GamepadPoller(a)
    expect(poller.poll([])).toBeNull()
    poller.poll([pad([0], { 0: 1 })])
    poller.poll([pad([0], { 0: 1 })])
    poller.poll([pad([0], {})])
    poller.poll([pad([0], { 9: 1 })])
    expect(calls).toEqual(['reset', 'pause'])
  })
})

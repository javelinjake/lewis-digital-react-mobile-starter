import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Controls } from '@/features/driving/components/Controls'
import { attachFocusGuard } from '@/features/driving/input/focus-guard'
import { ControlHub } from '@/features/driving/input/hub'
import { layoutFor, TouchControls } from '@/features/driving/input/touch-controls'

afterEach(cleanup)

/** jsdom drops `pointerId` from event init, so define it explicitly the way browsers provide it. */
function pointer(el: Element, type: 'pointerdown' | 'pointerup' | 'pointercancel' | 'lostpointercapture', pointerId: number) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'pointerId', { value: pointerId })
  fireEvent(el, ev)
}

const noopActions = { reset: () => {}, camera: () => {}, lock: () => {}, pause: () => {} }

describe('touch ownership (AC10)', () => {
  it('lets steering, throttle and brake be held by different fingers at the same time', () => {
    const t = new TouchControls()
    t.press('left', 1)
    t.press('throttle', 2)
    t.press('brake', 3)
    expect(t.toRaw()).toMatchObject({ left: true, right: false, throttle: true, brake: true })
    // Lifting one finger releases only its own control.
    t.release(2)
    expect(t.toRaw()).toMatchObject({ left: true, throttle: false, brake: true })
    t.release(1)
    t.release(3)
    expect(t.toRaw()).toMatchObject({ left: false, right: false, throttle: false, brake: false })
  })

  it('ignores a release from a pointer that owns nothing and cancels opposing steer buttons', () => {
    const t = new TouchControls()
    expect(t.release(99)).toBeNull()
    t.press('left', 1)
    t.press('right', 2)
    expect(t.toRaw()).toMatchObject({ left: false, right: false })
  })

  it('reverse is a deliberate latch and releaseAll clears everything', () => {
    const t = new TouchControls()
    t.press('reverse', 1)
    expect(t.toRaw().reverse).toBe(true)
    t.press('reverse', 2)
    expect(t.toRaw().reverse).toBe(false)
    t.press('reverse', 3)
    t.press('throttle', 4)
    t.releaseAll()
    expect(t.toRaw()).toMatchObject({ throttle: false, reverse: false })
  })

  it('notifies listeners so the pad can show its pressed state', () => {
    const t = new TouchControls()
    const seen: string[] = []
    t.onChange((pad, down) => seen.push(`${pad}:${down}`))
    t.press('brake', 1)
    t.release(1)
    expect(seen).toEqual(['brake:true', 'brake:false'])
  })

  it('mirrors the layout for left-handed play', () => {
    expect(layoutFor(false)).toEqual({ steer: 'left', pedals: 'right' })
    expect(layoutFor(true)).toEqual({ steer: 'right', pedals: 'left' })
  })
})

describe('on-screen controls component', () => {
  it('drives the hub from independent pointers and clears on cancel and lost capture', () => {
    const hub = new ControlHub(noopActions)
    const { getByTestId } = render(<Controls hub={hub} leftHanded={false} scale={1} powered enabled />)
    pointer(getByTestId('pad-left'), 'pointerdown', 1)
    pointer(getByTestId('pad-throttle'), 'pointerdown', 2)
    pointer(getByTestId('pad-brake'), 'pointerdown', 3)
    const raw = hub.read()
    expect(raw.left && raw.throttle && raw.brake).toBe(true)
    expect(getByTestId('pad-throttle').classList.contains('is-down')).toBe(true)
    pointer(getByTestId('pad-throttle'), 'pointercancel', 2)
    pointer(getByTestId('pad-brake'), 'lostpointercapture', 3)
    const after = hub.read()
    expect(after.left).toBe(true)
    expect(after.throttle || after.brake).toBe(false)
    expect(getByTestId('pad-throttle').classList.contains('is-down')).toBe(false)
  })

  it('ignores touches while the run is not live and hides throttle on gravity challenges', () => {
    const hub = new ControlHub(noopActions)
    const { getByTestId, queryByTestId } = render(<Controls hub={hub} leftHanded={false} scale={1} powered={false} enabled={false} />)
    expect(queryByTestId('pad-throttle')).toBeNull()
    pointer(getByTestId('pad-brake'), 'pointerdown', 1)
    expect(hub.read().brake).toBe(false)
  })

  it('marks and applies the left-handed layout and control scale', () => {
    const hub = new ControlHub(noopActions)
    const { getByTestId } = render(<Controls hub={hub} leftHanded scale={1.3} powered enabled />)
    const root = getByTestId('controls')
    expect(root.dataset.leftHanded).toBe('true')
    expect(root.className).toContain('is-mirrored')
    expect(root.style.getPropertyValue('--ctl-scale')).toBe('1.3')
  })
})

describe('focus loss clears held input (AC10)', () => {
  it('releases touch and keyboard input on blur, page hide and a hidden tab', () => {
    const hub = new ControlHub(noopActions)
    hub.attach()
    const detach = attachFocusGuard(hub)

    hub.touch.press('throttle', 1)
    hub.touch.press('right', 2)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(hub.read().throttle).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(hub.read()).toMatchObject({ throttle: false, right: false, left: false, brake: false })

    hub.touch.press('brake', 3)
    window.dispatchEvent(new Event('pagehide'))
    expect(hub.read().brake).toBe(false)

    hub.touch.press('brake', 4)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(hub.read().brake).toBe(false)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    detach()
    hub.touch.press('brake', 5)
    window.dispatchEvent(new Event('blur'))
    expect(hub.read().brake).toBe(true)
    hub.detach()
  })
})

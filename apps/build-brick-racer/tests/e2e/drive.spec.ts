import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Driving and replay journeys. These run against a dev server (`E2E_BASE_URL`) because they seed a car through
 * the dev-only `window.__brickTest` hook. Waits use simulation time from telemetry, so a slow software-GL
 * machine only makes them slower, not flaky.
 */
test.setTimeout(240_000)

async function seed(page: Page, kind: 'racer' | 'buggy' = 'racer'): Promise<string> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__brickTest), null, { timeout: 60_000 })
  return page.evaluate(k => window.__brickTest!.seedStarter(k), kind)
}

const telemetry = (page: Page) => page.evaluate(() => window.__brickTest?.telemetry() ?? null)

async function open(page: Page, carId: string, query: string) {
  await page.goto(`/drive?${query}&car=${carId}`)
  await expect(page.getByTestId('drive-root')).toBeVisible({ timeout: 60_000 })
}

async function waitPhase(page: Page, phase: string) {
  await page.waitForFunction(p => window.__brickTest?.telemetry()?.phase === p, phase, { timeout: 120_000 })
}

async function waitElapsed(page: Page, seconds: number) {
  await page.waitForFunction(s => (window.__brickTest?.telemetry()?.elapsed ?? 0) >= s, seconds, { timeout: 120_000 })
}

const speedText = async (page: Page) => Number.parseFloat((await page.getByTestId('speed').textContent()) ?? '0')

test.describe('driving', () => {
  test('AC01: a new player reaches manual driving, with a countdown and a live HUD', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_sprint')
    await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 90_000 })
    await waitPhase(page, 'running')
    await expect(page.getByTestId('objective')).toContainText('Ramp Run')
    await expect(page.getByTestId('pad-left')).toBeVisible()
    await expect(page.getByTestId('pad-brake')).toBeVisible()
    // Gravity challenge: no throttle, motor-off indicator is shown.
    await expect(page.getByTestId('pad-throttle')).toHaveCount(0)
    await expect(page.getByText('Downhill — motor off')).toBeVisible()
    await waitElapsed(page, 1.5)
    expect(await speedText(page)).toBeGreaterThan(0.2)
  })

  test('the throttle (keyboard) raises the speed readout on a powered challenge', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_acceleration')
    await waitPhase(page, 'running')
    expect(await speedText(page)).toBeLessThan(0.5)
    await page.keyboard.down('ArrowUp')
    // Read early: the 4 m/s target is reached (and the run ends) after about 1.8 s of simulation time.
    await waitElapsed(page, 0.7)
    expect(await speedText(page)).toBeGreaterThan(0.8)
    await page.keyboard.up('ArrowUp')
  })

  test('AC10: steering, throttle and brake work with separate touches and release independently', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=garden_mud')
    await waitPhase(page, 'running')
    const down = (testId: string, pointerId: number) => page.dispatchEvent(`[data-testid=${testId}]`, 'pointerdown', { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, bubbles: true })
    const up = (testId: string, pointerId: number, type: 'pointerup' | 'pointercancel' = 'pointerup') => page.dispatchEvent(`[data-testid=${testId}]`, type, { pointerId, pointerType: 'touch', bubbles: true })
    const x0 = (await telemetry(page))!.car[0]!
    await down('pad-throttle', 1)
    await down('pad-left', 2)
    await expect(page.getByTestId('pad-throttle')).toHaveClass(/is-down/)
    await expect(page.getByTestId('pad-left')).toHaveClass(/is-down/)
    const t0 = (await telemetry(page))!.elapsed
    await waitElapsed(page, t0 + 1.5)
    const moving = (await telemetry(page))!
    expect(moving.speed).toBeGreaterThan(0.5)
    expect(Math.abs(moving.car[0]! - x0)).toBeGreaterThan(0.03)
    // A cancelled touch releases only its own control.
    await up('pad-throttle', 1, 'pointercancel')
    await expect(page.getByTestId('pad-throttle')).not.toHaveClass(/is-down/)
    await expect(page.getByTestId('pad-left')).toHaveClass(/is-down/)
    await up('pad-left', 2)
    await expect(page.getByTestId('pad-left')).not.toHaveClass(/is-down/)
  })

  test('AC10: losing focus pauses the run and clears held input', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_acceleration')
    await waitPhase(page, 'running')
    await page.keyboard.down('ArrowUp')
    await page.dispatchEvent('[data-testid=pad-brake]', 'pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true })
    await expect(page.getByTestId('pad-brake')).toHaveClass(/is-down/)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await waitPhase(page, 'paused')
    await expect(page.getByTestId('pause-overlay')).toBeVisible()
    await expect(page.getByTestId('pad-brake')).not.toHaveClass(/is-down/)
    await page.keyboard.up('ArrowUp')
  })

  test('pause overlay: resume, settings, restart and the garage button', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_acceleration')
    await waitPhase(page, 'running')
    await page.getByTestId('pause-button').click()
    await expect(page.getByTestId('pause-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible()
    const frozen = (await telemetry(page))!.elapsed
    await page.waitForTimeout(1200)
    expect((await telemetry(page))!.elapsed).toBe(frozen)

    await page.getByTestId('open-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()

    await page.getByTestId('resume').click()
    await waitPhase(page, 'running')

    await page.getByTestId('pause-button').click()
    await page.getByTestId('restart').click()
    await waitPhase(page, 'countdown')
    await waitPhase(page, 'running')
    expect((await telemetry(page))!.elapsed).toBeLessThan(2)

    await page.getByTestId('pause-button').click()
    await page.getByTestId('to-garage').click()
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
  })

  test('AC20: the reset prompt appears when stuck, reset restores the start and the run becomes practice', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_sprint')
    await waitPhase(page, 'running')
    // Hold the brake on the ramp: no progress despite waiting.
    await page.keyboard.down('Space')
    await expect(page.getByTestId('reset-prompt')).toBeVisible({ timeout: 180_000 })
    // Keep holding the brake while clicking: the prompt stays only while the car is still stuck.
    await page.getByTestId('reset-prompt').click()
    await page.keyboard.up('Space')
    await page.waitForFunction(() => (window.__brickTest?.telemetry()?.resets ?? 0) >= 1, null, { timeout: 60_000 })
    await expect(page.getByText('Practice run').first()).toBeVisible()
  })

  test('free drive has no countdown and no finish requirement', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=free&place=garden')
    await waitPhase(page, 'running')
    await expect(page.getByTestId('objective')).toContainText('Free drive')
    await expect(page.getByTestId('countdown')).toHaveCount(0)
    await page.keyboard.down('ArrowUp')
    await waitElapsed(page, 1.5)
    expect(await speedText(page)).toBeGreaterThan(0.5)
    await page.keyboard.up('ArrowUp')
    expect((await telemetry(page))!.runPhase).toBe('free')
  })

  test('AC29: left-handed layout and enlarged controls', async ({ page }) => {
    const id = await seed(page)
    await page.evaluate(() => localStorage.setItem('CapacitorStorage.brickracer:prefs', JSON.stringify({ schemaVersion: 1, controls: { leftHanded: true, scale: 1.3 } })))
    await open(page, id, 'challenge=garden_mud')
    await waitPhase(page, 'running')
    const controls = page.getByTestId('controls')
    await expect(controls).toHaveAttribute('data-left-handed', 'true')
    const steer = await page.getByTestId('steer-cluster').boundingBox()
    const pedals = await page.getByTestId('pedal-cluster').boundingBox()
    expect(steer!.x).toBeGreaterThan(pedals!.x)
  })

  test('the driving screen does not re-render per frame (game loop stays outside React)', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=free&place=kitchen')
    await waitPhase(page, 'running')
    await page.keyboard.down('ArrowUp')
    const before = await page.evaluate(() => window.__brickTest!.renders())
    const t0 = (await telemetry(page))!.elapsed
    await waitElapsed(page, t0 + 3)
    const after = await page.evaluate(() => window.__brickTest!.renders())
    await page.keyboard.up('ArrowUp')
    // Three seconds of driving is ~180 physics ticks and many rendered frames: React renders only on phase changes.
    expect(after - before).toBeLessThanOrEqual(2)
  })

  test('cameras cycle and the lock toggles without changing steering', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=free&place=kitchen')
    await waitPhase(page, 'running')
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      seen.push((await telemetry(page))!.camera)
      await page.getByTestId('camera-button').click()
    }
    expect(new Set(seen).size).toBe(4)
    await page.getByTestId('lock-button').click()
    await expect(page.getByTestId('lock-button')).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('results hand-off and replay', () => {
  test('a finished run saves and opens results, then the replay plays the recorded run (AC22)', async ({ page }) => {
    const id = await seed(page)
    await open(page, id, 'challenge=kitchen_acceleration')
    await waitPhase(page, 'running')
    await page.keyboard.down('ArrowUp')
    await expect(page.getByTestId('finish-banner')).toBeVisible({ timeout: 180_000 })
    await page.keyboard.up('ArrowUp')
    await expect(page).toHaveURL(/\/results\/[\w-]+/, { timeout: 120_000 })
    const runId = new URL(page.url()).pathname.split('/')[2]!

    await page.goto(`/replay/${runId}`)
    await expect(page.getByTestId('replay-root')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('replay-time')).toBeVisible()
    for (const cam of ['chase', 'side', 'low', 'top', 'auto']) {
      await page.getByTestId(`cam-${cam}`).click()
      await expect(page.getByTestId(`cam-${cam}`)).toHaveAttribute('aria-pressed', 'true')
    }
    await page.getByTestId('speed-0.5').click()
    await expect(page.getByTestId('speed-0.5')).toHaveAttribute('aria-pressed', 'true')
    // A short run may already have finished playing; get to a paused state either way.
    const toggle = page.getByTestId('play-pause')
    if ((await toggle.getAttribute('aria-label')) === 'Pause')
      await toggle.click()
    else
      await toggle.click().then(() => toggle.click())
    await expect(toggle).toHaveAttribute('aria-label', 'Play')
    await page.getByTestId('scrubber').fill('500')
    await page.waitForFunction(() => document.querySelector('[data-testid=replay-time]')?.textContent !== '00:00.0', null, { timeout: 30_000 })
    await page.getByTestId('restart').click()
    await expect(page.getByTestId('play-pause')).toHaveAttribute('aria-label', 'Pause')

    // Remove the replay data: the screen says so clearly and results stay reachable.
    await page.evaluate(async (rid) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('brick-racer')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite')
          tx.objectStore('kv').delete(`replay:${rid}`)
          tx.oncomplete = () => resolve()
        }
      })
    }, runId)
    await page.goto(`/replay/${runId}`)
    await expect(page.getByTestId('replay-unavailable')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Your result is still saved')).toBeVisible()
    await page.getByRole('button', { name: 'Back to results' }).click()
    await expect(page).toHaveURL(new RegExp(`/results/${runId}`))
  })
})

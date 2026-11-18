import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Screen journeys on landscape phone and tablet (AC01, AC17, AC23, AC27, AC28, AC29).
 * Tests that seed cars and runs use a DEV-only helper (`window.__brickScreensTest`), so run them against a dev
 * server: `E2E_BASE_URL=http://127.0.0.1:5203 PLAYWRIGHT_CHROMIUM_PATH=... pnpm exec playwright test tests/e2e/screens.spec.ts`.
 * They skip themselves when the helper is not present (for example against a production build).
 */

async function openGarage(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()
}

async function hookReady(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.__brickScreensTest))
}

async function seedCar(page: Page, kind: 'racer' | 'buggy' = 'racer'): Promise<string> {
  const id = await page.evaluate(k => window.__brickScreensTest!.seedCar(k), kind)
  expect(id).toBeTruthy()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rename car' })).toBeVisible()
  return id!
}

test.describe('first play (AC01)', () => {
  test('Try a car goes straight to driving', async ({ page }) => {
    await openGarage(page)
    await expect(page.getByRole('button', { name: 'Build a car' })).toBeVisible()
    await page.getByRole('button', { name: 'Try a car' }).click()
    await expect(page).toHaveURL(/\/drive$/)
  })

  test('Build a car -> starter selection -> Start building opens the builder', async ({ page }) => {
    await openGarage(page)
    await page.getByRole('button', { name: 'Build a car' }).click()
    await expect(page).toHaveURL(/\/starters$/)
    await expect(page.getByRole('radio', { name: /Racer/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Buggy/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Start empty/ })).toBeVisible()
    await page.getByRole('radio', { name: /Buggy/ }).click()
    await expect(page.getByRole('radio', { name: /Buggy/ })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: /Start building/i }).click()
    await expect(page).toHaveURL(/\/build\/.+/)
  })
})

test.describe('garage (AC27)', () => {
  test('rename, duplicate and delete with confirmation', async ({ page }) => {
    await openGarage(page)
    test.skip(!(await hookReady(page)), 'needs the dev-only seeding helper')
    await seedCar(page, 'racer')

    await page.getByRole('button', { name: 'Rename car' }).click()
    await page.getByLabel('Car name').fill('Mud Monster')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Mud Monster', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'More car options' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(page.getByText('Mud Monster copy', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show Mud Monster' })).toBeVisible()

    await page.getByRole('button', { name: 'More car options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Delete Mud Monster copy?')
    await expect(dialog).toContainText('history stays safe')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Mud Monster copy', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'More car options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Mud Monster copy', { exact: true })).toHaveCount(0)

    // Changes persist.
    await page.reload()
    await expect(page.getByText('Mud Monster', { exact: true })).toBeVisible()
  })
})

test.describe('challenges and ready (AC17)', () => {
  test('all eight challenges and free drive are reachable; power mode is shown read-only', async ({ page }) => {
    await openGarage(page)
    test.skip(!(await hookReady(page)), 'needs the dev-only seeding helper')
    await seedCar(page)
    await page.getByRole('button', { name: /^Drive/ }).click()
    await expect(page).toHaveURL(/\/play$/)

    await expect(page.getByRole('tab', { name: 'Kitchen' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('radio')).toHaveCount(5)
    await page.getByRole('radio', { name: /Kitchen Ramp Run/ }).click()
    await page.getByRole('button', { name: /Next/ }).click()
    await expect(page).toHaveURL(/\/ready$/)
    await expect(page.getByTestId('power-label')).toHaveText('Gravity — motor off')

    await page.getByRole('button', { name: 'Back to challenges' }).click()
    await page.getByRole('tab', { name: 'Garden' }).click()
    await expect(page.getByRole('radio')).toHaveCount(3)
    await page.getByRole('radio', { name: /Garden Hill Climb/ }).click()
    await page.getByRole('button', { name: /Next/ }).click()
    await expect(page.getByTestId('power-label')).toHaveText('Motor on')

    await page.getByRole('button', { name: 'Back to challenges' }).click()
    await expect(page.getByRole('tab', { name: 'Garden' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: /Free drive/ }).click()
    await expect(page).toHaveURL(/\/ready$/)
    await expect(page.getByRole('heading', { name: 'Free drive' })).toBeVisible()
  })

  test('steering help, camera and lock are remembered', async ({ page }) => {
    await openGarage(page)
    test.skip(!(await hookReady(page)), 'needs the dev-only seeding helper')
    await seedCar(page)
    await page.getByRole('button', { name: /^Drive/ }).click()
    await page.getByRole('button', { name: /Next/ }).click()
    await page.getByLabel('Steering help').uncheck()
    await page.getByRole('combobox', { name: 'Camera' }).selectOption('smart')
    await page.getByLabel('Lock camera behind car').check()
    await page.goto('/settings')
    await expect(page.getByLabel('Steering help')).not.toBeChecked()
    await expect(page.getByRole('combobox', { name: 'Camera' })).toHaveValue('smart')
  })
})

test.describe('results and details (AC23)', () => {
  test('personal best with previous run, replay label and details tabs', async ({ page }) => {
    await openGarage(page)
    test.skip(!(await hookReady(page)), 'needs the dev-only seeding helper')
    const carId = await seedCar(page)
    const ids = await page.evaluate(async (id) => {
      const t = window.__brickScreensTest!
      const a = await t.seedRun({ carId: id, challengeId: 'garden_mud', metrics: { time: 23.1, peakSpeed: 2.4 }, withReplay: true })
      await t.editWheels(id)
      const b = await t.seedRun({ carId: id, challengeId: 'garden_mud', metrics: { time: 21.8, peakSpeed: 2.6 }, completion: 'great', withReplay: true })
      const c = await t.seedRun({ carId: id, challengeId: 'garden_climb', metrics: {}, status: 'ended', endReason: 'timeout', progress: 0.63 })
      return { a, b, c }
    }, carId)

    await page.goto(`/results/${ids.b}`)
    await expect(page.getByRole('heading', { name: 'MUD RUN COMPLETE' })).toBeVisible()
    await expect(page.getByTestId('result-value')).toHaveText('00:21.8')
    await expect(page.getByTestId('result-badge')).toHaveText('Personal best')
    await expect(page.getByTestId('result-previous')).toContainText('00:23.1')
    await expect(page.getByTestId('result-delta')).toHaveText('1.3 seconds quicker')
    await expect(page.getByRole('button', { name: 'Watch replay' })).toBeEnabled()

    await page.getByRole('button', { name: /Details/ }).click()
    await expect(page).toHaveURL(/\/details$/)
    const table = page.getByTestId('run-table')
    await expect(table).toContainText('00:21.8')
    await expect(table).toContainText('00:23.1')
    await expect(page.getByTestId('build-changes')).toContainText('Larger wheels')
    await page.getByRole('tab', { name: 'Car' }).click()
    await expect(page.getByTestId('car-table')).toContainText('Wheels')
    await page.getByRole('tab', { name: 'Tests' }).click()
    await expect(page.getByTestId('tests-table')).toContainText('Not tested yet')
    await page.getByText('Back to results', { exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/results/${ids.b}$`))

    // An incomplete run is honest: no time, a clear status, progress kept.
    await page.goto(`/results/${ids.c}`)
    await expect(page.getByRole('heading', { name: 'TRY AGAIN' })).toBeVisible()
    await expect(page.getByTestId('result-value')).toHaveText('63%')
    await expect(page.getByRole('button', { name: 'Replay unavailable' })).toBeDisabled()
    await expect(page.locator('body')).not.toContainText(/\d\d:\d\d\.\d/)
  })

  test('a missing run shows a friendly empty state', async ({ page }) => {
    await page.goto('/results/does-not-exist')
    await expect(page.getByText(/could not find that result/i)).toBeVisible()
  })
})

test.describe('settings (AC29)', () => {
  test('left-handed, control size, reduced motion and mute persist after reload', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
    await page.getByLabel('Left-handed').check()
    await page.getByLabel('Reduced motion').check()
    await page.getByLabel('Mute all sound').check()
    // React tracks input values, so use the native setter the way a real slider drag does.
    await page.getByLabel('Control size').evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '1.35')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(page.getByTestId('control-preview')).toHaveAttribute('data-lefty', 'true')

    await page.reload()
    await expect(page.getByLabel('Left-handed')).toBeChecked()
    await expect(page.getByLabel('Reduced motion')).toBeChecked()
    await expect(page.getByLabel('Mute all sound')).toBeChecked()
    await expect(page.getByLabel('Control size')).toHaveValue('1.35')
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true')
  })

  test('help opens from settings and the tutorial can be replayed', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Help' }).click()
    await expect(page).toHaveURL(/\/help$/)
    await page.getByRole('tab', { name: 'Drive' }).click()
    await expect(page.getByText('Stuck or upside down? Tap reset.')).toBeVisible()
    await page.getByRole('button', { name: /Replay the building tutorial/ }).click()
    await expect(page.getByRole('status')).toContainText('shows the next time you build')
  })
})

test.describe('offline and network (AC28)', () => {
  test('the main screen journeys make no requests beyond the app itself', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const foreign: string[] = []
    page.on('request', (r) => {
      const url = r.url()
      if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))
        foreign.push(url)
    })
    await openGarage(page)
    await page.getByRole('button', { name: 'Build a car' }).click()
    await expect(page.getByRole('radio', { name: /Racer/ })).toBeVisible()
    await page.getByRole('button', { name: 'Back to garage' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Help' }).click()
    await expect(page.getByRole('tab', { name: 'Build' })).toBeVisible()
    expect(foreign).toEqual([])
  })

  test('screens keep working when the network goes away after the first load', async ({ page, context }) => {
    await openGarage(page)
    await page.getByRole('button', { name: 'Build a car' }).click()
    await expect(page.getByRole('radio', { name: /Racer/ })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Back to garage' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByLabel('Vibration').click()
    await page.getByRole('button', { name: /Done/ }).click()
    await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()
    await context.setOffline(false)
  })
})

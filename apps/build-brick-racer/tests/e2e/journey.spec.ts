import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Spec section 20: reproduce a run from the normal garage flow. A brand new player builds the Racer, drives the
 * Kitchen Quick Start with the keyboard throttle, finishes, sees results with a personal best, opens details and
 * watches the replay. No seeding and no hooks other than reading simulation time (`window.__brickTest`, present in
 * end-to-end builds only) so the wait is on simulation time, not wall-clock.
 */
test.setTimeout(300_000)

async function waitPhase(page: Page, phase: string) {
  await page.waitForFunction(p => window.__brickTest?.telemetry()?.phase === p, phase, { timeout: 150_000 })
}

test('garage -> build -> challenge -> drive -> results -> details -> replay, from a clean profile', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()

  // First play: build a car from the Racer starter.
  await page.getByRole('button', { name: 'Build a car' }).click()
  await expect(page).toHaveURL(/\/starters$/)
  await page.getByRole('radio', { name: /Racer/ }).click()
  await page.getByRole('button', { name: /Start building/i }).click()
  await expect(page).toHaveURL(/\/build\/.+/)

  // Builder: the starter drives as it is. Drive goes to challenge selection.
  await page.getByTestId('drive').click()
  await expect(page).toHaveURL(/\/play$/)
  await page.getByRole('radio', { name: /Kitchen Quick Start/ }).click()
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page).toHaveURL(/\/ready$/)
  await page.getByRole('button', { name: /^Start/ }).click()
  await expect(page).toHaveURL(/\/drive$/)

  // Countdown, Go, then hold the throttle (keyboard) until the target speed has been held.
  await waitPhase(page, 'running')
  await page.keyboard.down('ArrowUp')
  await expect(page).toHaveURL(/\/results\/.+/, { timeout: 150_000 })
  await page.keyboard.up('ArrowUp')

  // Results: finished, a readable time, and the first eligible result is the personal best.
  await expect(page.getByText(/Personal best/i).first()).toBeVisible()
  await expect(page.getByText(/\d\d:\d\d\.\d/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Drive again/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Change car/i })).toBeVisible()

  // Details table shows the run, then back.
  await page.getByRole('button', { name: /Details/i }).click()
  await expect(page).toHaveURL(/\/details$/)
  await expect(page.getByText(/Top speed/i).first()).toBeVisible()
  await page.getByRole('button', { name: /Back to results/i }).first().click()

  // The replay of that exact run opens.
  await page.getByRole('button', { name: /Watch replay/i }).click()
  await expect(page).toHaveURL(/\/replay\/.+/)
  await expect(page.getByRole('button', { name: /Back to results/i }).first()).toBeVisible({ timeout: 60_000 })

  // Back to the garage: the car and its thumbnail are saved there and survive a reload.
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Rename car' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rename car' })).toBeVisible()
})

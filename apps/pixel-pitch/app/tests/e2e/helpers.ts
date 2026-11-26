import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

/**
 * Every test runs as on a normal modern phone. The app's low-effects mode switches on by itself for a device with
 * four cores or fewer, which includes GitHub's runners, and then shows the whole written match report at once with
 * no Skip button. Tests that want a weak device call `weakDevice(page)`.
 */
export const test = base.extend<{ strongDevice: void }>({
  strongDevice: [async ({ context }, use) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true })
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true })
    })
    await use()
  }, { auto: true }],
})
export { expect }

/** Reports a weak phone (two cores, 2 GB) from the next page load on, so low-effects mode turns on. */
export async function weakDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2, configurable: true })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2, configurable: true })
  })
}

export const HOUR = 60 * 60 * 1000

export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** A first launch: no sign-in, the device gets its own account and the player lands on founding a club. */
export async function guest(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding/)
}

/** On the first match's intro (five-a-side, your squad is ready): starts the match. */
export async function kickOff(page: Page) {
  await expect(page.getByText('Your first match')).toBeVisible()
  await page.getByRole('button', { name: 'Kick off' }).click()
}

/** Founds a club, watches nothing of the debut (skips it) and lands on the squad, as a new player would. */
export async function foundClub(page: Page, name = 'Harbour Town') {
  await guest(page)
  await page.getByLabel('Club name').fill(name)
  await page.getByRole('button', { name: 'Blue and white' }).click()
  await page.getByRole('button', { name: 'Found the club' }).click()
  await expect(page).toHaveURL(/\/match\/-1/)
  await kickOff(page)
  await page.getByRole('button', { name: 'Skip to full time' }).click()
  await page.getByRole('button', { name: 'Meet your squad' }).click()
  await expect(page).toHaveURL(/\/squad/)
  await page.getByRole('button', { name: 'Got it' }).click()
}

/** The mock game runs on a clock Playwright can move. */
export async function advanceClock(page: Page, ms: number) {
  await page.evaluate(by => window.__pixelPitchClock!.advance(by), ms)
}

export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })

/** Settings is behind the button in the header of the tab screens, not a tab of its own. */
export async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

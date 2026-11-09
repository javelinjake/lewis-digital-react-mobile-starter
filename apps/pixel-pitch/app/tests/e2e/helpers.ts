import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

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

/** Founds a club, watches nothing of the debut (skips it) and lands on the squad, as a new player would. */
export async function foundClub(page: Page, name = 'Harbour Town') {
  await guest(page)
  await page.getByLabel('Club name').fill(name)
  await page.getByRole('button', { name: 'Blue and white' }).click()
  await page.getByRole('button', { name: 'Found the club' }).click()
  await expect(page).toHaveURL(/\/match\/-1/)
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/squad/)
}

/** The mock game runs on a clock Playwright can move. */
export async function advanceClock(page: Page, ms: number) {
  await page.evaluate(by => window.__pixelPitchClock!.advance(by), ms)
}

export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })

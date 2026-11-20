import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// Runs the app against the real api app and database. Start them first:
//   pnpm db:dev    (or pnpm db:up)
//   pnpm --filter @ld/api-template cms:migrate && pnpm --filter @ld/api-template dev
//   E2E_LIVE=1 VITE_DATA_MODE=live pnpm --filter @ld/app-template test:e2e live
test.skip(!process.env.E2E_LIVE, 'Needs the api app. Set E2E_LIVE=1 to run.')

async function continueAsGuest(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await expect(page).toHaveURL(/\/home/)
}

async function openNotes(page: Page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Notes' }).click()
  await expect(page).toHaveURL(/\/notes/)
}

async function addNote(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add note' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Body').fill('Written in the live test')
  await page.getByRole('button', { name: 'Save' }).click()
}

/** Reads the signed-in person's notes straight from the api, through the same-origin /api proxy. */
function serverTitles(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/notes?depth=0&limit=100', { credentials: 'include' })
    const body = await response.json() as { docs: Array<{ title: string }> }
    return body.docs.map(note => note.title)
  })
}

test.describe('live backend @live', () => {
  test('a guest saves a note that survives a reload and is stored once on the server', async ({ page }) => {
    await continueAsGuest(page)
    await openNotes(page)
    await addNote(page, 'Live note')

    await expect(page.getByRole('link', { name: /Live note/ })).toBeVisible()
    await expect.poll(() => serverTitles(page)).toEqual(['Live note'])

    await page.reload()
    await openNotes(page)
    await expect(page.getByRole('link', { name: /Live note/ })).toHaveCount(1)
  })

  test('one guest never sees another guest\'s notes', async ({ browser }) => {
    const first = await browser.newPage()
    await continueAsGuest(first)
    await openNotes(first)
    await addNote(first, 'Only for the first guest')
    await expect.poll(() => serverTitles(first)).toContain('Only for the first guest')

    const second = await browser.newPage()
    await continueAsGuest(second)
    await openNotes(second)
    await expect(second.getByText('Only for the first guest')).toHaveCount(0)
    expect(await serverTitles(second)).not.toContain('Only for the first guest')
  })

  test('a note written offline is stored exactly once after reconnecting', async ({ page, context }) => {
    await continueAsGuest(page)
    await openNotes(page)
    await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeHidden()

    await context.setOffline(true)
    await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeVisible()
    await addNote(page, 'Written offline')
    await expect(page.getByRole('link', { name: /Written offline/ }).getByText('Pending', { exact: true })).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText('Pending', { exact: true })).toBeHidden({ timeout: 15_000 })
    await expect.poll(async () => (await serverTitles(page)).filter(title => title === 'Written offline').length).toBe(1)
  })

  test('deleting the account removes the data from the server', async ({ page }) => {
    await continueAsGuest(page)
    await openNotes(page)
    await addNote(page, 'Gone with the account')
    await expect.poll(() => serverTitles(page)).toEqual(['Gone with the account'])

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /Account/ }).click()
    await page.getByRole('button', { name: 'Delete my account' }).click()
    await page.getByRole('button', { name: 'Delete account', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)

    const status = await page.evaluate(async () => (await fetch('/api/notes', { credentials: 'include' })).status)
    expect([401, 403]).toContain(status)
  })
})

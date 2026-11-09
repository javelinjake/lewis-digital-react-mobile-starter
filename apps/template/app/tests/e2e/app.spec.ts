import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/home/)
}

test.describe('App smoke @smoke', () => {
  test('login screen renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('has a mobile viewport meta with safe-area support', async ({ page }) => {
    await page.goto('/login')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')
  })

  test('home route is protected', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Tabs layout @layout', () => {
  test('shows the bottom tab bar and navigates between tabs', async ({ page }) => {
    await signIn(page, 'user-a@example.com')

    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav).toBeVisible()
    await nav.getByRole('link', { name: 'Notes' }).click()
    await expect(page).toHaveURL(/\/notes/)
    await expect(page.getByText('Welcome')).toBeVisible()
  })
})

test.describe('Offline @offline', () => {
  test('notes created offline are marked pending and shown in the banner', async ({ page, context }) => {
    await signIn(page, 'user-a@example.com')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Welcome')).toBeVisible()

    await context.setOffline(true)
    await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeVisible()

    await page.getByRole('button', { name: 'Add note' }).click()
    await page.getByLabel('Title').fill('Written offline')
    await page.getByLabel('Body').fill('Still on this device')
    await page.getByRole('button', { name: 'Save' }).click()

    const offlineNote = page.getByRole('link', { name: /Written offline/ })
    await expect(offlineNote).toBeVisible()
    await expect(offlineNote.getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.getByRole('status').getByText('1 pending')).toBeVisible()

    await context.setOffline(false)
    await expect(offlineNote.getByText('Pending', { exact: true })).toBeHidden({ timeout: 10_000 })
  })

  test('create, reopen, reconnect stores exactly one server record', async ({ page }) => {
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Welcome')).toBeVisible()

    await page.evaluate(() => window.__ldNotesTest?.setOffline(true))
    await page.getByRole('button', { name: 'Add note' }).click()
    await page.getByLabel('Title').fill('Written offline')
    await page.getByLabel('Body').fill('Survives reopen')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('link', { name: /Written offline/ }).getByText('Pending', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('link', { name: /Written offline/ }).getByText('Pending', { exact: true })).toBeVisible()

    await page.evaluate(() => window.__ldNotesTest?.setOffline(false))
    await page.evaluate(() => window.__ldTest?.flush())
    await expect(page.getByText('Pending', { exact: true })).toBeHidden({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: /Written offline/ })).toHaveCount(1)

    const ids = await page.evaluate(() => window.__ldNotesTest?.serverIds() ?? [])
    expect(ids.filter(id => id !== 'welcome')).toHaveLength(1)
  })

  test('expired session keeps the write with the same account', async ({ page }) => {
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await page.evaluate(() => window.__ldNotesTest?.setOffline(true))
    await page.getByRole('button', { name: 'Add note' }).click()
    await page.getByLabel('Title').fill('Held for Ada')
    await page.getByLabel('Body').fill('Do not replay as Bee')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Held for Ada')).toBeVisible()

    await page.evaluate(() => {
      window.__ldNotesTest?.setOffline(false)
      window.__ldNotesTest?.expireSession()
    })
    await page.evaluate(() => window.__ldTest?.flush())
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await signIn(page, 'bee@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Held for Ada')).toHaveCount(0)
    const whileBee = await page.evaluate(() => window.__ldNotesTest?.serverIds() ?? [])
    expect(whileBee.filter(id => id !== 'welcome')).toHaveLength(0)

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /Account/ }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Held for Ada')).toBeVisible()
    await page.evaluate(() => window.__ldTest?.flush())
    await expect(page.getByText('Pending', { exact: true })).toBeHidden({ timeout: 10_000 })
    const ids = await page.evaluate(() => window.__ldNotesTest?.serverIds() ?? [])
    expect(ids.filter(id => id !== 'welcome')).toHaveLength(1)
  })

  test('account switch does not replay another user queue', async ({ page }) => {
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await page.evaluate(() => window.__ldNotesTest?.setOffline(true))
    await page.getByRole('button', { name: 'Add note' }).click()
    await page.getByLabel('Title').fill('Ada only')
    await page.getByLabel('Body').fill('Parked')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Ada only')).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /Account/ }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)

    await signIn(page, 'bee@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Ada only')).toHaveCount(0)

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /Account/ }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByText('Ada only')).toBeVisible()
    await page.evaluate(() => window.__ldNotesTest?.setOffline(false))
    await page.evaluate(() => window.__ldTest?.flush())
    await expect(page.getByText('Pending', { exact: true })).toBeHidden({ timeout: 10_000 })
    const ids = await page.evaluate(() => window.__ldNotesTest?.serverIds() ?? [])
    expect(ids.filter(id => id !== 'welcome')).toHaveLength(1)
  })
})

test.describe('Accounts @auth', () => {
  test('a guest can start without an account and is offered one in settings', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(page).toHaveURL(/\/home/)

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('button', { name: /Create an account/ })).toBeVisible()
    await page.getByRole('button', { name: /Create an account/ }).click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Keep your progress' })).toBeVisible()
  })

  test('a guest can still reach sign in, to keep what they made', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(page).toHaveURL(/\/home/)

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByText('what you made as a guest comes with you')).toBeVisible()
  })

  test('creating an account asks the person to check their email', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Ada')
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password').fill('a-long-enough-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText('ada@example.com')).toBeVisible()
  })

  test('refuses a short password before sending anything', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Ada')
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Use at least 10 characters')).toBeVisible()
  })

  test('the reset link needs a token', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible()
    await page.goto('/reset-password?token=abc')
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  })

  test('deleting the account signs out and clears what the device held', async ({ page }) => {
    await signIn(page, 'user-a@example.com')
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /Account/ }).click()
    await page.getByRole('button', { name: 'Delete my account' }).click()
    await page.getByRole('button', { name: 'Delete account', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login/)
  })
})

import { expect, test } from '@playwright/test'
import { foundClub, signIn, tab } from './helpers'

test.describe('Larger screens @layout', () => {
  test('on a tablet or desktop browser the game is a centred column with the tab bar inside it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await foundClub(page)
    const nav = await page.getByRole('navigation', { name: 'Primary' }).boundingBox()
    const header = await page.getByRole('banner').boundingBox()
    expect(nav!.width).toBeLessThan(800)
    expect(header!.width).toBe(nav!.width)
    // Centred: the same gap each side.
    expect(Math.abs(nav!.x - (1440 - nav!.x - nav!.width))).toBeLessThan(2)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
  })
})

test.describe('Accounts @auth', () => {
  test('a player on this device is offered a cloud save in settings, and cannot sign out and lose the club', async ({ page }) => {
    await foundClub(page)
    await tab(page, 'Settings').click()
    await expect(page.getByRole('button', { name: /^Account/ })).toHaveCount(0)
    await page.getByRole('button', { name: /This device/ }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: /Save to the cloud/ }).click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Save to the cloud' })).toBeVisible()
  })

  test('signing in to the cloud from a new device brings back the cloud club', async ({ page }) => {
    // The cloud account and its club, made earlier on another device.
    await signIn(page, 'ada@example.com')
    await expect(page).toHaveURL(/\/onboarding/)
    await page.getByLabel('Club name').fill('Ada United')
    await page.getByRole('button', { name: 'Found the club' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await tab(page, 'Settings').click()
    await page.getByRole('button', { name: /ada@example.com/ }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()

    // The new device: straight to a new club, with a way to sign in instead.
    await expect(page).toHaveURL(/\/onboarding/)
    await page.getByRole('link', { name: 'Sign in to the cloud' }).click()
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password').fill('secret')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/club/)
    await expect(page.getByRole('heading', { name: 'Ada United' })).toBeVisible()
  })

  test('a device club signed in to an account that has a club plays the account club only', async ({ page }) => {
    await signIn(page, 'ada@example.com')
    await page.getByLabel('Club name').fill('Ada United')
    await page.getByRole('button', { name: 'Found the club' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await tab(page, 'Settings').click()
    await page.getByRole('button', { name: /ada@example.com/ }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()

    await foundClub(page, 'Device Rovers')
    await tab(page, 'Settings').click()
    await page.getByRole('button', { name: /Sign in to the cloud/ }).click()
    await expect(page.getByText('you get that club and the one on this device is deleted')).toBeVisible()
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password').fill('secret')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/club/)
    await expect(page.getByRole('heading', { name: 'Ada United' })).toBeVisible()
    await expect(page.getByText(/Device Rovers/)).toHaveCount(0)
  })

  test('a device club signed in to a new account moves to it', async ({ page }) => {
    await foundClub(page, 'Device Rovers')
    await tab(page, 'Settings').click()
    await page.getByRole('button', { name: /Sign in to the cloud/ }).click()
    await page.getByLabel('Email').fill('bee@example.com')
    await page.getByLabel('Password').fill('secret')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/club/)
    await expect(page.getByRole('heading', { name: 'Device Rovers' })).toBeVisible()
  })

  test('creating an account asks the person to check their email', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Ada')
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password').fill('a-long-enough-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
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

  test('a signed-in player without a club starts at onboarding', async ({ page }) => {
    await signIn(page, 'user-a@example.com')
    await expect(page).toHaveURL(/\/onboarding/)
  })
})

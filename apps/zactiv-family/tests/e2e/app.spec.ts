import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const workout = {
  id: 7,
  name: 'Burpee Burnout Challenge',
  short_description: 'Move together.',
  time: '30 min',
  image: '8690aa20-3813-4de3-91ef-d84961cb2e14',
  warm_up: '<p><strong>Warm Up</strong></p><ul><li>Gentle squats</li></ul>',
  main_workout: '<p><strong>Workout</strong></p><ul><li>15 burpees</li><li>20 squats</li></ul>',
  more_notes: 'Find a clear space.',
  zactivs: 10,
  status: 'published',
  tags: [],
}

const recipe = {
  id: 3,
  name: 'Coconut & Butterbean Noodles',
  short_description: 'Creamy and ready in 20 minutes.',
  time_prep: 10,
  time_cook: 10,
  servings_adults_base: 2,
  ingredients: '<ul><li>250 g noodles</li><li>1 tbsp olive oil</li></ul>',
  instructions: '<ol><li>Soften the garlic.</li><li>Add the noodles.</li></ol>',
  status: 'published',
  tags: [{ recipe_tags_id: { name: 'Dinner' } }],
}

async function mockDirectus(page: Page) {
  let current: { id: string, email: string, first_name: string, family_name: string } | null = null

  await page.route('http://localhost:8055/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/auth/login')) {
      current = { id: 'user-a', email: 'ada@example.com', first_name: 'Ada', family_name: 'Lewis family' }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { access_token: 'token', refresh_token: 'refresh', expires: 900000 } }),
      })
      return
    }

    if (url.includes('/auth/refresh') || url.includes('/auth/logout')) {
      await route.fulfill({
        status: current ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(current ? { data: { access_token: 'token', refresh_token: 'refresh', expires: 900000 } } : { errors: [{ message: 'Token expired' }] }),
      })
      return
    }

    if (url.includes('/users/me')) {
      await route.fulfill({
        status: current ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(current ? { data: { ...current, zactivs_balance: 50 } } : { errors: [{ message: 'Token expired' }] }),
      })
      return
    }

    if (url.includes('/items/workouts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: url.includes('/items/workouts/7') ? workout : [workout] }) })
      return
    }

    if (url.includes('/items/recipes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: url.includes('/items/recipes/3') ? recipe : [recipe] }) })
      return
    }

    if (url.includes('/items/videos') || url.includes('/items/logs')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: url.includes('/items/logs') ? { id: 1 } : [] }) })
      return
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })
}

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('ada@example.com')
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('heading', { name: /together/ })).toBeVisible()
}

test('login screen renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('home is protected', async ({ page }) => {
  await mockDirectus(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('tabs, workout list, ingredients, and journal save', async ({ page }) => {
  await mockDirectus(page)
  await signIn(page)

  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link', { name: 'Workouts' })).toBeVisible()
  await nav.getByRole('link', { name: 'Workouts' }).click()
  await expect(page.getByText('Burpee Burnout Challenge')).toBeVisible()
  await page.getByRole('link', { name: /Burpee Burnout Challenge/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '15 burpees' })).toBeVisible()
  await expect(page.getByText('<p')).toHaveCount(0)
  await expect(page.locator('main img').first()).toHaveAttribute('src', /access_token=/)
  await page.getByRole('button', { name: 'Back' }).click()

  await nav.getByRole('link', { name: 'Recipes' }).click()
  await page.getByRole('link', { name: /Coconut/ }).first().click()
  await page.getByRole('link', { name: 'View all ingredients' }).click()
  await page.getByRole('checkbox', { name: /noodles/ }).check()
  await expect(page.getByRole('checkbox', { name: /noodles/ })).toBeChecked()

  await page.goto('/journal')
  await page.getByLabel('Today’s note').fill('Lucas was proud of his drawing.')
  await page.getByRole('button', { name: 'Save chat' }).click()
  await expect(page.getByText('Saved for today.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Today’s note')).toHaveValue('Lucas was proud of his drawing.')
})

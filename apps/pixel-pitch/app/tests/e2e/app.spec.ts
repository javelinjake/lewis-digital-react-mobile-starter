import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const HOUR = 60 * 60 * 1000

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function guest(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
}

/** Founds a club, watches nothing of the debut (skips it) and lands on the squad, as a new player would. */
async function foundClub(page: Page, name = 'Harbour Town') {
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
async function advanceClock(page: Page, ms: number) {
  await page.evaluate(by => window.__pixelPitchClock!.advance(by), ms)
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name })

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

  test('the club is protected', async ({ page }) => {
    await page.goto('/club')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('First session @game', () => {
  test('a new player founds a club, wins the debut and gets a fielded squad', async ({ page }) => {
    await guest(page)
    await page.getByLabel('Club name').fill('Harbour Town')
    await page.getByRole('button', { name: 'Found the club' }).click()

    await expect(page).toHaveURL(/\/match\/-1\?debut=1/)
    // The written report is the default view.
    await expect(page.getByRole('list', { name: 'Match report' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page).toHaveURL(/\/squad/)
    await expect(page.getByRole('button', { name: /^(GK|DEF|MID|FWD): .+rated \d+/ })).toHaveCount(5)
    await expect(page.getByText(/Win \d+% · Draw \d+% · Loss \d+%/)).toBeVisible()
    // The squad is longer than the screen: the tab bar stays on screen while it scrolls.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
    await page.getByRole('heading', { name: /^Squad \(/ }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
  })

  test('the pitch view plays the match on a canvas and counts the minutes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pp-replay-mode', 'pitch'))
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    const minute = page.locator('main span.text-center')
    await expect(minute).toHaveText(/^\d+'$/)
    await expect.poll(async () => Number.parseInt(await minute.textContent() ?? '0'), { timeout: 10_000 }).toBeGreaterThan(10)
    const drawn = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return pixels.some((value, index) => index % 4 === 3 && value > 0)
    })
    expect(drawn).toBe(true)
  })

  test('the written report fills in line by line, ends on the final score, and can be switched to the pitch', async ({ page }) => {
    test.setTimeout(60_000)
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    const report = page.getByRole('list', { name: 'Match report' })
    const lines = report.getByRole('listitem')

    // It starts with the kick-off and grows as the match goes on.
    await expect(lines.first()).toContainText(/underway|whistle|kick-off|v .*five|Here we go|no room to hide|tempo/i)
    await expect.poll(() => lines.count()).toBeGreaterThan(2)

    // The same match on the pitch, and back again.
    await page.getByRole('tab', { name: 'Pitch' }).click()
    await expect(page.getByLabel('Match replay')).toBeVisible()
    await page.getByRole('tab', { name: 'Match report' }).click()
    await expect(report).toBeVisible()

    // Left to run, a whole match takes under half a minute.
    await expect(page.getByText('Full time', { exact: true })).toBeVisible({ timeout: 35_000 })
    const header = await page.locator('main [aria-live="polite"]').textContent() ?? ''
    const score = /(\d+)–(\d+)/.exec(header)!
    await expect(lines.first()).toContainText(`${score[1]}–${score[2]}`)
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
  })

  test('the match view is a setting that is remembered', async ({ page }) => {
    await foundClub(page)
    await tab(page, 'Settings').click()
    await expect(page.getByRole('button', { name: /Match view/ })).toContainText('Written report')
    await page.getByRole('button', { name: /Match view/ }).click()
    await expect(page.getByRole('button', { name: /Match view/ })).toContainText('Pixel pitch')

    await page.goto('/match/-1')
    await expect(page.getByRole('tab', { name: 'Pitch' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Match replay')).toBeVisible()
  })

  test('the formation changes the lineup, the odds and the hint', async ({ page }) => {
    await foundClub(page)
    const odds = page.getByText(/Win \d+% · Draw \d+% · Loss \d+%/)
    const before = await odds.textContent()
    await page.getByRole('radio', { name: /Wall/ }).click()
    await expect(page.getByRole('radio', { name: /Wall/ })).toHaveAttribute('aria-checked', 'true')
    await expect(odds).not.toHaveText(before!)
    await expect(page.getByRole('button', { name: /^Try .+ against their/ }).or(page.getByText('This is your best formation against them.'))).toBeVisible()
  })

  test('a slot can be refilled from the squad sheet', async ({ page }) => {
    await foundClub(page)
    await page.getByRole('button', { name: /^GK: / }).click()
    const sheet = page.getByRole('dialog', { name: 'Pick a GK' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Leave this slot empty' }).click()
    await expect(page.getByRole('button', { name: 'GK: empty' })).toBeVisible()
    await page.getByRole('button', { name: 'Auto-pick' }).click()
    await expect(page.getByRole('button', { name: /^GK: .+rated/ })).toBeVisible()
  })
})

test.describe('Time away @game', () => {
  test('a day away plays eight matches and shows them in the table and the summary', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 24 * HOUR + 5 * 60_000)
    await page.goto('/club')
    const welcome = page.getByRole('dialog', { name: 'Welcome back' })
    await expect(welcome).toBeVisible()
    await expect(welcome.getByText(/8 matches played/)).toBeVisible()
    await welcome.getByRole('button', { name: 'Let\'s go' }).click()

    await tab(page, 'League').click()
    const ours = page.getByRole('row', { name: /Harbour Town/ })
    await expect(ours.getByRole('cell').nth(2)).toHaveText('8')
    await expect(page.getByRole('link', { name: /^Match 8 v / })).toBeVisible()
  })

  test('a week away climbs out of League 5', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 7 * 24 * HOUR)
    await page.goto('/club')
    await expect(page.getByRole('dialog', { name: 'Welcome back' }).getByText(/Promoted to League [1-4]!/)).toBeVisible()
  })
})

test.describe('Accounts @auth', () => {
  test('a guest is offered an account in settings', async ({ page }) => {
    await foundClub(page)
    await tab(page, 'Settings').click()
    await page.getByRole('button', { name: /Create an account/ }).click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: 'Keep your progress' })).toBeVisible()
  })

  test('a guest can still reach sign in, to keep what they made', async ({ page }) => {
    await guest(page)
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

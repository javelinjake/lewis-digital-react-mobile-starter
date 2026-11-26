import { advanceClock, expect, foundClub, HOUR, openSettings, tab, test } from './helpers'

const arcadeTab = (page: Parameters<typeof tab>[0]) => tab(page, 'Arcade')

test.describe('The next tap is always on screen @flow', () => {
  test('the tabs are Club, Packs, Squad, Arcade and League, and Settings is a button in the header', async ({ page }) => {
    await foundClub(page)
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link')).toHaveText([/Club/, /Packs/, /Squad/, /Arcade/, /League/])
    await expect(nav.getByRole('link', { name: /Settings/ })).toHaveCount(0)
    await openSettings(page)
    // Settings is a page you can go back from.
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/squad|\/club/)
  })

  test('the tabs say what is waiting: claims on Club, packs on Packs and energy on Arcade', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 5 * HOUR)
    await page.goto('/club')
    await page.getByRole('button', { name: /^(Let's go|Not now)$/ }).click()
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link', { name: /Club/ }).getByLabel(/waiting$/)).toBeVisible()
    await expect(nav.getByRole('link', { name: /Packs/ }).getByLabel(/waiting$/)).toBeVisible()
    await expect(nav.getByRole('link', { name: /Arcade/ }).getByLabel('5 waiting')).toBeVisible()
    // The Arcade is a tab now, with its own screen.
    await arcadeTab(page).click()
    await expect(page).toHaveURL(/\/arcade$/)
    await expect(page.getByRole('region', { name: 'Energy' })).toBeVisible()
  })

  test('the club hub lists what is ready, and one button takes everything and says what it paid', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 5 * HOUR)
    await page.goto('/club')
    await page.getByRole('button', { name: /^(Let's go|Not now)$/ }).click()
    const ready = page.getByRole('region', { name: 'Ready now' })
    await expect(ready.getByText(/coins in the stadium/)).toBeVisible()
    await expect(ready.getByText(/tokens in the arcade tray/)).toBeVisible()
    await expect(ready.getByText(/Calendar reward, day 1/)).toBeVisible()
    await expect(ready.getByText(/Your free pack/)).toBeVisible()
    await expect(ready.getByText(/packs? to open/)).toBeVisible()
    await expect(ready.getByText(/Arcade: 5 energy to spend/)).toBeVisible()

    await ready.getByRole('button', { name: /^Claim all/ }).click()
    const pop = page.getByRole('dialog', { name: 'Claimed' })
    await expect(pop).toBeVisible()
    await expect(pop.getByText(/\+\d[\d,]* coins/)).toBeVisible()
    await expect(pop.getByText(/\+\d+ tokens/)).toBeVisible()
    await expect(pop.getByText(/packs? on the shelf/)).toBeVisible()
    // Packs came with it, so the next tap is to open them.
    await expect(pop.getByRole('link', { name: /^Open packs/ })).toBeVisible()
    await pop.getByRole('button', { name: 'Not now' }).click()

    // Nothing is left to claim: the card moves on to what is coming.
    await expect(page.getByRole('region', { name: 'Ready now' }).getByText(/Claim all/)).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Ready now' }).getByText(/packs? to open/)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Stadium' }).getByRole('button', { name: /^Collect 0$/ })).toBeDisabled()
  })

  test('each line on the hub goes to the screen that has it', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    const ready = page.getByRole('region', { name: 'Ready now' })
    await ready.getByRole('link', { name: /Your free pack/ }).click()
    await expect(page).toHaveURL(/\/goals/)
  })

  test('the welcome-back screen offers Claim all, and takes it', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 6 * HOUR)
    await page.goto('/club')
    const welcome = page.getByRole('dialog', { name: 'Welcome back' })
    await welcome.getByRole('button', { name: /^Claim all/ }).click()
    await expect(welcome).toBeHidden()
    await expect(page.getByRole('dialog', { name: 'Claimed' })).toBeVisible()
  })

  test('after an arcade play, the next steps are right there: claim what is waiting, or go to the packs', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 5 * HOUR)
    await page.goto('/arcade/keepy')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 20_000 })
    const next = page.getByRole('region', { name: 'Next steps' })
    await expect(next.getByRole('button', { name: /^Claim all/ })).toBeVisible()
    await expect(next.getByRole('link', { name: /packs? to open/ })).toBeVisible()
    await next.getByRole('button', { name: /^Claim all/ }).click()
    await expect(page.getByRole('dialog', { name: 'Claimed' })).toBeVisible()
  })

  test('opening a pack can be rushed: Reveal all goes straight to sign or sell, and the next pack is one tap away', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 3 * HOUR + 60_000)
    await page.goto('/packs')
    await page.getByRole('button', { name: 'Open a pack' }).click()
    await page.getByRole('button', { name: 'Tear open the pack' }).click()
    await page.getByRole('button', { name: 'Reveal all' }).click()
    await expect(page.getByRole('heading', { name: 'Your new players' })).toBeVisible()
    await page.getByRole('button', { name: /^Done and open the next pack \(\d+ left\)/ }).click()
    // The next pack is open at once, ready to tear.
    await expect(page.getByRole('button', { name: 'Tear open the pack' })).toBeVisible()
  })

  test('the warm-up result points to the lineup', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    const warmup = page.getByRole('region', { name: 'Warm-up kick' })
    await warmup.getByRole('button', { name: 'Warm up' }).click()
    await page.waitForTimeout(400)
    await warmup.getByRole('button', { name: 'KICK!' }).click()
    await expect(warmup.getByRole('link', { name: /Set the lineup/ })).toBeVisible()
  })
})

import { advanceClock, expect, foundClub, HOUR, tab, test } from './helpers'

test.describe('Time away @game', () => {
  test('nine hours away plays the quick opening and then a match every three hours, and shows them in the table and the summary', async ({ page }) => {
    await foundClub(page)
    // Five opening matches in the first 50 minutes, then two more three hours apart. Seven matches cannot reach the
    // 30 points that promote, which would start the table's count again.
    await advanceClock(page, 9 * HOUR + 5 * 60_000)
    await page.goto('/club')
    const welcome = page.getByRole('dialog', { name: 'Welcome back' })
    await expect(welcome).toBeVisible()
    await expect(welcome.getByText(/7 matches played/)).toBeVisible()
    // The latest matches are listed, each opening its report.
    await expect(welcome.getByRole('list', { name: 'Matches played' }).getByRole('link')).toHaveCount(3)
    await welcome.getByRole('button', { name: 'Not now' }).click()

    await tab(page, 'League').click()
    const ours = page.getByRole('row', { name: /Harbour Town/ })
    await expect(ours.getByRole('cell').nth(2)).toHaveText('7')
    await expect(page.getByRole('link', { name: /^Match 7 v / })).toBeVisible()
  })

  test('a match played while away can be watched from the welcome-back summary', async ({ page }) => {
    await foundClub(page)
    // The first match kicks off 5 minutes in; 12 minutes in it was well before the player looked, so it was missed.
    await advanceClock(page, 12 * 60_000)
    await page.goto('/club')
    const welcome = page.getByRole('dialog', { name: 'Welcome back' })
    await welcome.getByRole('link', { name: 'Watch the match' }).click()
    await expect(page).toHaveURL(/\/match\/0$/)
    await expect(page.getByText('League 5 · Match 1')).toBeVisible()
    await page.getByRole('button', { name: 'Skip to full time' }).click()
    await expect(page.getByLabel('Scorers').or(page.getByText('No goals.'))).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    // Seen once, it opens on its result next time instead of playing again.
    await page.goto('/match/0')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip to full time' })).toHaveCount(0)
  })

  test('a match the player is there for stops at its live moment, which can be let go', async ({ page }) => {
    await foundClub(page)
    // A minute after the first kick-off: the player was there for it.
    await advanceClock(page, 6 * 60_000)
    await page.goto('/club')
    await page.getByRole('dialog', { name: 'Welcome back' }).getByRole('link', { name: 'Watch the match' }).click()
    await expect(page).toHaveURL(/\/match\/0$/)
    const moment = page.getByRole('region', { name: 'Live moment' })
    // An early moment stops the report on its own; otherwise Skip to full time stops at it.
    const skip = page.getByRole('button', { name: 'Skip to full time' })
    await expect(moment.or(skip)).toBeVisible()
    if (await skip.isVisible())
      await skip.click()
    await expect(moment).toBeVisible()
    await expect(moment.getByRole('button', { name: /^Take it · \d+s$/ })).toBeVisible()
    await moment.getByRole('button', { name: 'Let it play' }).click()
    await expect(moment).toHaveCount(0)
    // Let go, the report carries on from the moment (or ends, if Skip brought it there).
    const scorers = page.getByLabel('Scorers').or(page.getByText('No goals.'))
    await expect(scorers.or(skip)).toBeVisible()
    if (await skip.isVisible())
      await skip.click()
    await expect(scorers).toBeVisible()
  })

  test('a friendly plays now, pays coins and no league points', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    await page.getByRole('button', { name: 'Play a friendly' }).click()
    await expect(page).toHaveURL(/\/match\/-2$/)
    await expect(page.getByText('Friendly · no league points')).toBeVisible()
    await page.getByRole('button', { name: 'Skip to full time' }).click()
    await expect(page.getByText('A friendly: coins, but no league points.')).toBeVisible()
  })

  test('a week away climbs out of League 5', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 7 * 24 * HOUR)
    await page.goto('/club')
    await expect(page.getByRole('dialog', { name: 'Welcome back' }).getByText(/Promoted to League [1-4]!/)).toBeVisible()
  })
})

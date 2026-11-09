import { expect, test } from '@playwright/test'

// Runs the app against the real api app and database. Start them first:
//   pnpm db:dev
//   pnpm --filter @ld/api-pixel-pitch cms:migrate && pnpm --filter @ld/api-pixel-pitch dev
//   E2E_LIVE=1 VITE_DATA_MODE=live pnpm --filter @ld/app-pixel-pitch test:e2e live
test.skip(!process.env.E2E_LIVE, 'Needs the api app. Set E2E_LIVE=1 to run.')

test.describe('live backend @live', () => {
  test('a player with no sign-in founds a club that the server keeps, privately, once', async ({ page }) => {
    // No sign-in: the first launch makes this device's account on the server.
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding/)
    await page.getByLabel('Club name').fill('Live Rovers')
    await page.getByRole('button', { name: 'Found the club' }).click()
    await expect(page).toHaveURL(/\/match\/-1/)
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/squad/)

    const clubs = await page.evaluate(async () => {
      const response = await fetch('/api/clubs?depth=0', { credentials: 'include' })
      return (await response.json() as { docs: Array<{ name: string }> }).docs.map(club => club.name)
    })
    expect(clubs).toEqual(['Live Rovers'])

    await page.reload()
    await expect(page.getByRole('button', { name: /^(GK|DEF|MID|FWD): .+rated \d+/ })).toHaveCount(5)
  })

  test('packs, goals and the arcade work against the real api: free pack, open, sign, then a Keepy-Uppy play', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/')
    await page.getByLabel('Club name').fill('Live Packs')
    await page.getByRole('button', { name: 'Found the club' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.goto('/goals')
    await page.getByRole('button', { name: /^Take 1 free pack/ }).click()
    await expect(page.getByRole('button', { name: /Taken today/ })).toBeDisabled()
    await page.getByRole('button', { name: 'Claim day 1' }).click()
    await expect(page.getByLabel('Day 1, claimed')).toBeVisible()

    await page.goto('/packs')
    await page.getByRole('button', { name: 'Open a pack' }).click()
    await page.getByRole('button', { name: 'Tear open the pack' }).click()
    for (let card = 0; card < 3; card++) {
      await page.getByRole('button', { name: 'Turn the card over' }).click()
      await (card < 2 ? page.getByRole('button', { name: 'Next', exact: true }) : page.getByRole('button', { name: 'Sign or sell' })).click()
    }
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('dialog', { name: 'Open pack' })).toBeHidden()

    // The server holds the club: a reload shows the same shelf and squad.
    await page.reload()
    await expect(page.getByLabel('0 of 10 packs')).toBeVisible()

    await page.goto('/arcade/keepy')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 25_000 })
  })
})

import { expect, test } from '@playwright/test'

// Runs the app against the real api app and database. Start them first:
//   pnpm db:dev
//   pnpm --filter @ld/api-pixel-pitch cms:migrate && pnpm --filter @ld/api-pixel-pitch dev
//   E2E_LIVE=1 VITE_DATA_MODE=live pnpm --filter @ld/app-pixel-pitch test:e2e live
test.skip(!process.env.E2E_LIVE, 'Needs the api app. Set E2E_LIVE=1 to run.')

test.describe('live backend @live', () => {
  test('a guest founds a club that the server keeps, privately, once', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue as guest' }).click()
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
})

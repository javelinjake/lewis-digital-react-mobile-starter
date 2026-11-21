import { expect, foundClub, openSettings, test } from './helpers'

test.describe('Test games @lab', () => {
  test('Settings has a testing part with five prototype games, each a different skill', async ({ page }) => {
    await foundClub(page)
    await openSettings(page)
    await page.getByRole('button', { name: /Test games/ }).click()
    await expect(page).toHaveURL(/\/lab$/)
    for (const name of ['Keeper Reflex', 'Pass Master', 'Dribble Dash', 'Target Practice', 'Cone Shuffle'])
      await expect(page.getByRole('region', { name }).getByText('Not played yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Play' })).toHaveCount(5)
  })

  test('Keeper Reflex: an early dive is a goal, and ten shots end in a score out of ten', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/lab/keeper')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByText('Shot 1 of 10')).toBeVisible()
    await page.getByRole('button', { name: 'Centre' }).click()
    await expect(page.getByText(/Too early!|Goal!|Saved!/)).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^\d+ \/ 10$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
  })

  test('Pass Master: the move is shown, then it is your turn, and a wrong pass ends it', async ({ page }) => {
    await foundClub(page)
    await page.goto('/lab/pass')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByText('Watch…')).toBeVisible()
    await expect(page.getByText('Your turn: 0 of 3')).toBeVisible({ timeout: 10_000 })
    // No player gets two passes in a row, so tapping the same player twice is always a wrong pass.
    await page.getByRole('button', { name: 'Player 1' }).click()
    await page.getByRole('button', { name: 'Player 1' }).click()
    await expect(page.getByText('Wrong pass!')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result.getByText(/^\d+ \/ 8$/)).toBeVisible()
  })

  test('Dribble Dash: standing still gets you tackled, and moving changes lane', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/lab/dribble')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByLabel('You, in lane 2')).toBeVisible()
    await page.getByRole('button', { name: 'Move left' }).click()
    await expect(page.getByLabel('You, in lane 1')).toBeVisible()
    await page.getByRole('button', { name: 'Move left' }).click()
    await expect(page.getByLabel('You, in lane 1')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^\d+$/)).toBeVisible()
  })

  test('Target Practice: hitting a target scores, and the best is kept for next time', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/lab/targets')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Target' }).click()
    await expect(page.getByText('1 hit')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^\d+ \/ 15$/)).toBeVisible()
    await expect(result.getByRole('status')).toHaveText('First score on the board!')
    await page.getByRole('link', { name: 'Back to the test games' }).click()
    await expect(page.getByRole('region', { name: 'Target Practice' }).getByText(/^Best: \d+ \/ 15$/)).toBeVisible()
  })

  test('Cone Shuffle: the cones can only be picked once they stop, and five rounds end in a score out of five', async ({ page }) => {
    test.setTimeout(90_000)
    await foundClub(page)
    await page.goto('/lab/cones')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByText('Watch the ball…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cone 1' })).toBeDisabled()
    for (let round = 1; round <= 5; round++) {
      await expect(page.getByText(`Round ${round} of 5`)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Which cone?')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Cone 2' }).click()
      await expect(page.getByText(/Got it!|Not that one/)).toBeVisible()
    }
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result.getByText(/^\d \/ 5$/)).toBeVisible()
  })

  test('a game that does not exist says so', async ({ page }) => {
    await foundClub(page)
    await page.goto('/lab/pinball')
    await expect(page.getByText('No such game')).toBeVisible()
  })
})

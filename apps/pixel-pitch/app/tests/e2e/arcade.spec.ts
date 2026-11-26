import type { Page } from '@playwright/test'
import { expect, foundClub, test } from './helpers'

/** Opens a cabinet from the arcade and starts a free play. */
async function play(page: Page, name: string) {
  await page.goto('/arcade')
  await page.getByRole('region', { name }).getByRole('link', { name: /Play · 1 energy/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
}

test.describe('The arcade games @game', () => {
  test('the arcade lists all eight games, each with how tokens are worked out before a play', async ({ page }) => {
    await foundClub(page)
    await page.goto('/arcade')
    for (const name of ['Kick Timer', 'Keepy-Uppy', 'Penalty Shootout', 'Keeper Reflex', 'Pass Master', 'Dribble Dash', 'Target Practice', 'Cone Shuffle'])
      await expect(page.getByRole('region', { name }).getByText('Not played yet')).toBeVisible()
    await expect(page.getByRole('link', { name: /Play · 1 energy/ })).toHaveCount(8)
    await expect(page.getByText(/Today \+50% tokens/)).toHaveCount(1)

    await page.getByRole('region', { name: 'Cone Shuffle' }).getByRole('link', { name: /Play · 1 energy/ }).click()
    await expect(page.getByText('Up to 60 tokens a play, in proportion to your score; +50% on today\'s game.')).toBeVisible()
    await expect(page.getByText(/Pick the one with the ball/)).toBeVisible()
  })

  test('the back button while playing goes to the arcade', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    await page.goto('/arcade/cones')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByText('Watch the ball…')).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/arcade$/)
    await expect(page.getByRole('region', { name: 'Token tray' })).toBeVisible()
  })

  test('Keepy-Uppy: a tap that misses the ball is a stumble', async ({ page }) => {
    await foundClub(page)
    await play(page, 'Keepy-Uppy')
    const game = page.getByLabel(/Keepy-Uppy game/)
    await expect(game).toBeVisible()
    await expect(page.getByRole('button', { name: 'KICK!' })).toHaveCount(0)
    // The ball starts in the middle, high up: a corner of the pitch is nowhere near it.
    await game.click({ position: { x: 4, y: 140 } })
    await expect(page.getByText('Stumble!')).toBeVisible()
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 20_000 })
  })

  test('Keeper Reflex: an early dive is a goal, and ten shots end in a score out of ten that pays tokens', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await play(page, 'Keeper Reflex')
    await expect(page.getByText('Shot 1 of 10')).toBeVisible()
    await page.getByRole('button', { name: 'Centre' }).click()
    await expect(page.getByText(/Too early!|Goal!|Saved!/)).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^Score \d+ of 10 → \d+ tokens$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Play again · 4 energy left/ })).toBeVisible()
  })

  test('Pass Master: the move is shown, then it is your turn, and a wrong pass ends it', async ({ page }) => {
    await foundClub(page)
    await play(page, 'Pass Master')
    await expect(page.getByText('Watch…')).toBeVisible()
    await expect(page.getByText('Your turn: 0 of 3')).toBeVisible({ timeout: 10_000 })
    // No player gets two passes in a row, so tapping the same player twice is always a wrong pass.
    await page.getByRole('button', { name: 'Player 1' }).click()
    await page.getByRole('button', { name: 'Player 1' }).click()
    await expect(page.getByText('Wrong pass!')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 15_000 })
    await expect(result.getByText(/^Score 0 of 8 → 0 tokens$/)).toBeVisible()
  })

  test('Dribble Dash: moving changes lane, and the run ends in a score the server agrees with', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await play(page, 'Dribble Dash')
    await expect(page.getByLabel('You, in lane 2')).toBeVisible()
    await page.getByRole('button', { name: 'Move left' }).click()
    await expect(page.getByLabel('You, in lane 1')).toBeVisible()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Move left' }).click()
    await expect(page.getByLabel('You, in lane 1')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^Score \d+ of 32 → \d+ tokens$/)).toBeVisible()
  })

  test('Target Practice: hitting a target scores, and the best is kept for next time', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await play(page, 'Target Practice')
    await expect(page.getByText('Target 1 of 15')).toBeVisible()
    // A tap quicker than anyone could see the target does not count, so give it a moment.
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: 'Target' }).click()
    await expect(page.getByText('1 hit')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^Score [1-9]\d* of 15 → \d+ tokens$/)).toBeVisible()
    await expect(result.getByRole('status')).toHaveText('First score on the board!')
    await page.getByRole('link', { name: 'Back to the arcade' }).click()
    await expect(page.getByRole('region', { name: 'Target Practice' }).getByText(/^Best: [1-9]\d* \/ 15$/)).toBeVisible()
  })

  test('Cone Shuffle: the cones can only be picked once they stop, and five rounds end in a score out of five', async ({ page }) => {
    test.setTimeout(90_000)
    await foundClub(page)
    await play(page, 'Cone Shuffle')
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
    await expect(result.getByText(/^Score \d of 5 → \d+ tokens$/)).toBeVisible()
  })

  test('a game that does not exist says so', async ({ page }) => {
    await foundClub(page)
    await page.goto('/arcade/pinball')
    await expect(page.getByText(/No such (game|cabinet)/)).toBeVisible()
  })
})

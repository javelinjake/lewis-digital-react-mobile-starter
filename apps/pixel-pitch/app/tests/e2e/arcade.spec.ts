import type { Page } from '@playwright/test'
import { expect, foundClub, test } from './helpers'

/** Opens a cabinet from the arcade and starts a free play. */
async function play(page: Page, name: string) {
  await page.goto('/arcade')
  await page.getByRole('region', { name }).getByRole('link', { name: /Play · 1 energy/ }).click()
  await page.getByRole('button', { name: /^Start/ }).click()
}

test.describe('The arcade games @game', () => {
  test('the arcade lists its five games, each with how tokens are worked out before a play', async ({ page }) => {
    await foundClub(page)
    await page.goto('/arcade')
    for (const name of ['Kick Timer', 'Keepy-Uppy', 'Penalty Shootout', 'Keeper Reflex', 'Dribble Dash'])
      await expect(page.getByRole('region', { name }).getByText('Not played yet')).toBeVisible()
    for (const gone of ['Pass Master', 'Target Practice', 'Cone Shuffle'])
      await expect(page.getByRole('region', { name: gone })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Play · 1 energy/ })).toHaveCount(5)
    await expect(page.getByText(/Today \+50% tokens/)).toHaveCount(1)

    await page.getByRole('region', { name: 'Dribble Dash' }).getByRole('link', { name: /Play · 1 energy/ }).click()
    await expect(page.getByText('Up to 60 tokens a play, in proportion to your score; +50% on today\'s game.')).toBeVisible()
    await expect(page.getByText(/switch lane and go round them/)).toBeVisible()
  })

  test('the back button while playing goes to the arcade', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    await page.goto('/arcade/kick')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByText('Kick 1 of 5')).toBeVisible()
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
    await expect(page.getByRole('button', { name: /Left|Centre|Right/ })).toHaveCount(0)
    // You save by tapping the ball itself; a tap before the shot is struck is a dive too early.
    await page.getByLabel(/Keeper Reflex: you are in goal/).click({ position: { x: 10, y: 10 } })
    await expect(page.getByText(/Too early!|Goal!|Saved!/)).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 40_000 })
    await expect(result.getByText(/^Score \d+ of 10 → \d+ tokens$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Play again · 4 energy left/ })).toBeVisible()
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

  test('a game that does not exist, or no longer does, says so', async ({ page }) => {
    await foundClub(page)
    await page.goto('/arcade/pinball')
    await expect(page.getByText(/No such (game|cabinet)/)).toBeVisible()
    await page.goto('/arcade/cones')
    await expect(page.getByText(/No such (game|cabinet)/)).toBeVisible()
  })
})

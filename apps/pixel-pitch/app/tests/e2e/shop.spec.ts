import { expect, foundClub, test } from './helpers'

test.describe('Shop @shop', () => {
  test('shows what money buys before it is bought, and the League Pass turns on the premium track', async ({ page }) => {
    await foundClub(page)
    await page.goto('/shop')
    await expect(page.getByText('Playtest build: purchases are pretend')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Starter offer' }).getByText('Star Signing', { exact: true })).toBeVisible()
    await expect(page.getByText(/Nothing in the shop is random/)).toBeVisible()

    await page.getByRole('button', { name: /^Buy League Pass/ }).click()
    await expect(page.getByText('Active for this season')).toBeVisible()
    await page.goto('/pass')
    await expect(page.getByText(/League Pass active for this season/)).toBeVisible()
  })

  test('the starter offer pays a Star Signing: three named Stars, and the chosen one joins the squad', async ({ page }) => {
    await foundClub(page)
    await page.goto('/shop')
    await page.getByRole('button', { name: /^Buy Starter offer/ }).click()
    await expect(page.getByRole('region', { name: 'Starter offer' })).toBeHidden()
    await page.goto('/club')
    await page.getByRole('link', { name: /Star Signing is waiting/ }).click()
    await expect(page.getByRole('button', { name: 'Sign' })).toHaveCount(3)
    await page.getByRole('button', { name: 'Sign' }).first().click()
    await expect(page.getByRole('button', { name: 'Players (6)' })).toBeVisible()
  })

  test('gems buy a new kit, worn at once', async ({ page }) => {
    await foundClub(page)
    await page.goto('/shop')
    await page.getByRole('button', { name: /^Buy Bag of gems/ }).click()
    await page.getByRole('list', { name: 'Premium kits' }).getByRole('button', { name: '150 gems' }).first().click()
    await expect(page.getByRole('button', { name: 'Wear Claret and sky' })).toHaveAttribute('aria-pressed', 'true')
  })
})

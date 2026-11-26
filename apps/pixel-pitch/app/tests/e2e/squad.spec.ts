import { expect, foundClub, test } from './helpers'

test.describe('Merging @game', () => {
  test('merging three copies says what changed for the player', async ({ page }) => {
    await foundClub(page)
    // Two more copies of a starter, put straight into the mock save (as if they came from packs).
    await page.evaluate(() => {
      // The mock keeps its save in sessionStorage, or localStorage in a playtest build.
      const store = [sessionStorage, localStorage].find(entry => Object.keys(entry).some(name => name.startsWith('pp-mock-club:')))!
      const key = Object.keys(store).find(entry => entry.startsWith('pp-mock-club:'))!
      const save = JSON.parse(store.getItem(key)!) as { cards: Array<{ id: string, playerId: string, stars: number, trained: number }>, nextCardId: number }
      const copied = save.cards[0]
      for (let copy = 0; copy < 2; copy++)
        save.cards.push({ id: String(save.nextCardId++), playerId: copied.playerId, stars: 1, trained: copy })
      store.setItem(key, JSON.stringify(save))
    })
    await page.goto('/squad?view=merge')
    const ready = page.getByRole('region', { name: 'Ready to merge' })
    await ready.getByRole('button', { name: /Merge into ★★/ }).click()

    const pop = page.getByRole('dialog', { name: 'Merged' })
    await expect(pop).toBeVisible()
    const changes = pop.getByRole('list', { name: 'What changed' })
    await expect(changes.getByText('★★', { exact: true })).toBeVisible()
    await expect(changes.getByText('+6', { exact: true })).toBeVisible()
    // The best training of the copies (one had +1) is kept.
    await expect(changes.getByRole('listitem').filter({ hasText: 'Training' })).toContainText('+1')
    await expect(changes.getByText('2 free')).toBeVisible()
    await page.screenshot({ path: 'test-results/merged-pop.png' })
    await pop.getByRole('button', { name: 'Nice' }).click()
    await expect(pop).toBeHidden()
    await expect(ready).toHaveCount(0)
  })
})

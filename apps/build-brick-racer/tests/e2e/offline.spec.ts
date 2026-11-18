import { expect, test } from '@playwright/test'

/**
 * AC28: the main journeys work offline. Against the production bundle the service worker precaches the app
 * shell, fonts and the physics engine (about 6 MB). After it has finished installing the network is cut and the
 * app is reloaded, then a drive is started: that needs the Rapier WASM chunk from the cache.
 */
test.setTimeout(240_000)

test('after first load the game reloads and starts a drive with the network off', async ({ page, context, baseURL }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()

  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator))
      return 'unsupported'
    await navigator.serviceWorker.ready
    // Wait for the precache to be filled (the physics chunk is the last and largest entry).
    for (let i = 0; i < 120; i++) {
      const names = await caches.keys()
      let count = 0
      for (const n of names) count += (await (await caches.open(n)).keys()).length
      if (count >= 30)
        return 'ready'
      await new Promise(r => setTimeout(r, 500))
    }
    return 'timeout'
  })
  test.skip(controlled === 'unsupported', 'service workers are not available in this browser context')
  expect(controlled).toBe('ready')

  // Reload once so the page is controlled by the worker, then cut the network.
  await page.reload()
  await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()
  await context.setOffline(true)

  const foreign: string[] = []
  page.on('request', (r) => {
    if (baseURL && !r.url().startsWith(baseURL) && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))
      foreign.push(r.url())
  })

  await page.reload()
  await expect(page.getByRole('heading', { name: /My Garage/i })).toBeVisible()

  // Build a car offline (client routing), then try a car straight into driving (loads the physics engine).
  await page.getByRole('button', { name: 'Build a car' }).click()
  await expect(page).toHaveURL(/\/starters$/)
  await page.goBack()
  await page.getByRole('button', { name: 'Try a car' }).click()
  await expect(page).toHaveURL(/\/drive$/)
  await expect(page.getByTestId('drive-root')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 90_000 })
  expect(foreign).toEqual([])
})

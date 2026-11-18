import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { PART_DEFINITIONS } from '../../src/game/catalog/parts'

/**
 * Builder end-to-end flows on landscape phone and tablet profiles, driven with real touch taps.
 * Cars are seeded through the app's own garage store via a dev-only hook (never present in production builds).
 */

type Kind = 'racer' | 'buggy' | 'empty'

const state = (page: Page) => page.evaluate(() => window.__brickBuilder!.state())

async function openBuilder(page: Page, kind: Kind): Promise<string> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__brickBuilder))
  const id = await page.evaluate(k => window.__brickBuilder!.seed(k), kind)
  expect(id).toBeTruthy()
  await page.goto(`/build/${id}`)
  await expect(page.getByTestId('builder')).toBeVisible()
  await expect.poll(async () => (await state(page)).saveState).toBe('saved')
  await page.waitForTimeout(900)
  return id!
}

/** Tap a snap ring near the middle of the 3D view. */
async function tapRing(page: Page, pick: 'middle' | 'first' = 'middle') {
  await expect.poll(() => page.evaluate(() => window.__brickBuilder!.rings().length), { timeout: 20_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(400)
  const rings = await page.evaluate(() => window.__brickBuilder!.rings())
  const box = (await page.locator('canvas.bd-canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  rings.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
  const r = pick === 'first' ? rings[0]! : rings[Math.min(rings.length - 1, Math.floor(rings.length / 3))]!
  await page.touchscreen.tap(r.x, r.y)
  // Rings that overlap on screen arm the "which spot?" control instead of placing straight away.
  await page.waitForTimeout(500)
  const confirm = page.getByTestId('place-here')
  if (await confirm.isVisible())
    await confirm.tap()
}

async function tapPart(page: Page, id: string) {
  let point = await page.evaluate(i => window.__brickBuilder!.partPoint(i), id)
  if (!point) {
    await page.evaluate(i => window.__brickBuilder!.select([i]), id)
    return
  }
  await page.touchscreen.tap(point.x, point.y)
  point = null
}

async function chooseCategoryPart(page: Page, defId: string) {
  const def = PART_DEFINITIONS.find(d => d.id === defId)!
  await page.getByTestId(`cat-${def.category}`).tap()
  await page.getByTestId(`part-${defId}`).tap()
  await expect.poll(async () => (await state(page)).partId).toBe(defId)
}

test.describe('Builder', () => {
  test('uses a bottom tray on phones and a left rail on tablets', async ({ page }) => {
    await openBuilder(page, 'racer')
    const width = page.viewportSize()!.width
    await expect(page.getByTestId('builder')).toHaveAttribute('data-layout', width >= 1000 ? 'rail' : 'bottom')
    await expect(page.getByTestId('tray')).toBeVisible()
    await expect(page.getByTestId('drive')).toBeVisible()
  })

  test('AC02: select a part, place it by touch, rotate, recolour and remove it', async ({ page }) => {
    await openBuilder(page, 'racer')
    const start = (await state(page)).instances

    await chooseCategoryPart(page, 'brick_2x2')
    await tapRing(page)
    await expect.poll(async () => (await state(page)).instances).toBe(start + 1)
    const placed = (await state(page)).selection[0]!
    expect(placed).toBeTruthy()

    const before = (await state(page)).rotation
    await page.getByTestId('tool-rotate').tap()
    await expect.poll(async () => (await state(page)).rotation).toBe((before + 1) % 4)

    await page.getByTestId('tool-colour').tap()
    await expect(page.getByTestId('colour-picker')).toBeVisible()
    await page.getByTestId('colour-red').tap()
    await expect.poll(() => page.evaluate(id => window.__brickBuilder!.colourOf(id), placed)).toBe('red')

    // Leave placing mode, tap the new brick to select it, then remove it.
    await page.getByTestId('tool-cancel').tap()
    await tapPart(page, placed)
    await expect.poll(async () => (await state(page)).selection).toEqual([placed])
    await page.getByTestId('tool-delete').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(start)
  })

  test('AC02: undo and redo work from the buttons and the keyboard', async ({ page }) => {
    await openBuilder(page, 'racer')
    const start = (await state(page)).instances
    await chooseCategoryPart(page, 'plate_2x2')
    await tapRing(page)
    await expect.poll(async () => (await state(page)).instances).toBe(start + 1)
    await page.getByTestId('undo').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(start)
    await page.getByTestId('redo').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(start + 1)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await state(page)).instances).toBe(start)
    await page.keyboard.press('Control+Shift+z')
    await expect.poll(async () => (await state(page)).instances).toBe(start + 1)
  })

  test('removing a supporting chassis piece asks first and keeps the loose pieces', async ({ page }) => {
    await openBuilder(page, 'racer')
    const s = await state(page)
    const chassis = s.ids[s.defs.indexOf('chassis_short')]!
    await tapPart(page, chassis)
    await expect.poll(async () => (await state(page)).selection).toEqual([chassis])
    await page.getByTestId('tool-delete').tap()
    await expect(page.getByTestId('delete-sheet')).toBeVisible()
    await expect(page.getByTestId('delete-sheet')).toContainText('Remove this part?')
    await page.getByTestId('delete-keep').tap()
    await expect(page.getByTestId('delete-sheet')).toBeHidden()
    expect((await state(page)).instances).toBe(s.instances)

    await page.getByTestId('tool-delete').tap()
    await page.getByTestId('delete-confirm').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(s.instances - 1)
    await expect(page.getByTestId('loose-chip')).toBeVisible()
  })

  test('AC03: a customised car survives switching between Easy and Free', async ({ page }) => {
    await openBuilder(page, 'racer')
    const s0 = await state(page)
    const wheel = s0.ids[s0.defs.indexOf('wheel_road')]!
    await tapPart(page, wheel)
    await expect(page.getByTestId('wheel-panel')).toBeVisible()
    await page.getByTestId('swap-wheel_wide').tap()
    await expect.poll(async () => (await state(page)).defs.filter(d => d === 'wheel_wide').length).toBe(2)

    const before = await state(page)
    for (const m of ['free', 'easy', 'free', 'easy'] as const) {
      await page.getByTestId(`mode-${m}`).tap()
      await expect.poll(async () => (await state(page)).mode).toBe(m)
    }
    const after = await state(page)
    expect(after.ids).toEqual(before.ids)
    expect(after.defs).toEqual(before.defs)
    expect(after.forward).toBe(before.forward)
    expect(after.wheelGroups).toBe(before.wheelGroups)
    expect(after.revision).toBe(before.revision)
  })

  test('AC06: a move that does not fit shows why and changes nothing', async ({ page }) => {
    await openBuilder(page, 'racer')
    await page.getByTestId('mode-free').tap()
    const s = await state(page)
    const spoiler = s.ids[s.defs.indexOf('spoiler')]!
    await tapPart(page, spoiler)
    await expect.poll(async () => (await state(page)).selection).toEqual([spoiler])
    await page.getByTestId('tool-nudge').tap()
    await page.getByTestId('nudge-down').tap()
    await expect(page.getByTestId('issue-banner')).toBeVisible()
    await expect(page.getByTestId('issue-banner')).toContainText('Nothing was changed')
    const after = await state(page)
    expect(after.revision).toBe(s.revision)
    expect(after.issues[0]).toBe('overlap')
  })

  test('Free Build panels show measurements, wheel roles and the front direction', async ({ page }) => {
    await openBuilder(page, 'racer')
    await page.getByTestId('mode-free').tap()
    await page.getByTestId('free-panels').tap()
    await expect(page.getByTestId('free-panel')).toBeVisible()
    await expect(page.getByTestId('inspect')).toContainText('Weight')
    await expect(page.getByTestId('inspect')).toContainText('Steadiness')
    await page.getByTestId('ftab-wheels').tap()
    await expect(page.getByTestId('wheel-groups')).toContainText('Front axle')
    const s = await state(page)
    const rev = s.revision
    await page.getByTestId('ftab-front').tap()
    await page.getByTestId('front-x+').tap()
    await expect.poll(async () => (await state(page)).forward).toBe('x+')
    expect((await state(page)).revision).not.toBe(rev)
    await page.getByTestId('undo').tap()
    await expect.poll(async () => (await state(page)).forward).toBe('z+')
  })

  test('Drive goes to challenge selection for a drivable car', async ({ page }) => {
    await openBuilder(page, 'racer')
    await page.getByTestId('drive').tap()
    await expect(page).toHaveURL(/\/play/)
  })

  test('Drive explains why a car without wheels cannot launch and keeps you building', async ({ page }) => {
    await openBuilder(page, 'empty')
    await expect(page.getByTestId('mode-free')).toHaveAttribute('aria-pressed', 'true')
    await chooseCategoryPart(page, 'brick_2x2')
    await page.getByTestId('place-first').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(1)
    await page.getByTestId('drive').tap()
    await expect(page.getByRole('dialog')).toContainText('can’t drive yet')
    await page.getByRole('button', { name: 'Go back and fix it' }).tap()
    await expect(page).toHaveURL(/\/build\//)
  })

  test('AC04: every one of the 36 parts can be chosen and placed repeatedly', async ({ page }) => {
    test.setTimeout(420_000)
    await openBuilder(page, 'empty')
    expect(PART_DEFINITIONS).toHaveLength(36)

    // A base to build on, plus mounts so wheels have somewhere to go.
    await chooseCategoryPart(page, 'chassis_long')
    await page.getByTestId('place-first').tap()
    await expect.poll(async () => (await state(page)).instances).toBe(1)

    for (const def of PART_DEFINITIONS) {
      await chooseCategoryPart(page, def.id)
      for (let copy = 0; copy < 2; copy++) {
        const before = (await state(page)).instances
        if (def.category === 'wheels') {
          let rings = await page.evaluate(() => window.__brickBuilder!.rings().length)
          if (rings === 0) {
            await chooseCategoryPart(page, 'wheel_mount')
            await page.getByTestId('place-loose').tap()
            await expect.poll(async () => (await state(page)).instances).toBe(before + 1)
            await chooseCategoryPart(page, def.id)
            rings = 1
          }
          const need = (await state(page)).instances
          await tapRing(page)
          await expect.poll(async () => (await state(page)).instances, { message: `${def.id} copy ${copy + 1}` }).toBeGreaterThan(need - 1)
          expect((await state(page)).defs.filter(d => d === def.id).length).toBeGreaterThanOrEqual(copy + 1)
        }
        else {
          await page.getByTestId('place-loose').tap()
          await expect.poll(async () => (await state(page)).instances, { message: `${def.id} copy ${copy + 1}` }).toBe(before + 1)
        }
      }
    }
    const counts = new Map<string, number>()
    for (const d of (await state(page)).defs)
      counts.set(d, (counts.get(d) ?? 0) + 1)
    for (const def of PART_DEFINITIONS)
      expect(counts.get(def.id) ?? 0, `${def.id} placed twice`).toBeGreaterThanOrEqual(2)
  })
})

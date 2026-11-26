import type { Page } from '@playwright/test'
import { advanceClock, expect, foundClub, guest, HOUR, kickOff, playWarmup, tab, test, weakDevice } from './helpers'

test.describe('App smoke @smoke', () => {
  test('login screen renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('has a mobile viewport meta with safe-area support', async ({ page }) => {
    await page.goto('/login')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')
  })

  test('a first launch needs no sign-in: it goes straight to founding a club', async ({ page }) => {
    await page.goto('/club')
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole('link', { name: 'Sign in to the cloud' })).toBeVisible()
  })
})

test.describe('First session @game', () => {
  test('a new player founds a club, wins the debut and gets a fielded squad', async ({ page }) => {
    await guest(page)
    await page.getByLabel('Club name').fill('Harbour Town')
    await page.getByRole('button', { name: 'Found the club' }).click()

    await expect(page).toHaveURL(/\/match\/-1\?debut=1/)
    // Before the first match: what it is, and a clear button to start it.
    await expect(page.getByText(/five-a-side/)).toBeVisible()
    await kickOff(page)
    await expect(page.getByText('Friendly · no league points')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next moment' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip to full time' }).click()
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
    // Who scored, and the way on pinned to the bottom of the screen.
    await expect(page.getByLabel('Scorers')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Meet your squad' })).toBeInViewport()
    await page.getByRole('button', { name: 'Meet your squad' }).click()

    await expect(page).toHaveURL(/\/squad/)
    await expect(page.getByRole('heading', { name: 'Your squad' })).toBeVisible()
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByRole('button', { name: /^(GK|DEF|MID|FWD): .+rated \d+/ })).toHaveCount(5)
    await expect(page.getByText(/^Win \d+% · Draw \d+% · Loss \d+%$/)).toBeVisible()
    // The squad is longer than the screen: the tab bar and Auto-pick stay on screen while it scrolls.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
    await page.getByText('Lineup score').scrollIntoViewIfNeeded()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Auto-pick best' })).toBeInViewport()
  })

  test('a weak phone gets the same paced report, not an instant one', async ({ page }) => {
    await weakDevice(page)
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    await expect(page).toHaveURL(/\/match\/-1/)
    await kickOff(page)
    await expect(page.getByRole('button', { name: 'Next moment' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip to full time' }).click()
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
    await page.getByRole('button', { name: 'Meet your squad' }).click()
    await expect(page).toHaveURL(/\/squad/)
  })

  test('the written report plays a moment at a time on its own, and a few taps take it to the final score', async ({ page }) => {
    test.setTimeout(60_000)
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    await kickOff(page)
    const card = page.getByRole('button', { name: 'Next moment' })
    const earlier = page.getByRole('list', { name: 'Match so far' }).getByRole('listitem')

    // It starts with the kick-off, big, and moves on by itself to the first chance.
    await expect(card).toContainText(/underway|whistle|kick-off|five a side|Here we go|no room to hide|tempo/i)
    await expect(earlier.first()).toBeVisible({ timeout: 12_000 })
    // There is no pitch view: the written report is the match.
    await expect(page.getByRole('tab', { name: 'Pitch' })).toHaveCount(0)

    // Tapping goes on sooner: a whole match in a few taps, ending on the result and the whole report.
    for (let taps = 0; taps < 40 && await card.isVisible(); taps++)
      await card.click()
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
    const report = page.getByRole('list', { name: 'Match report' }).getByRole('listitem')
    // A short read: the kick-off, a handful of chances (every goal is kept, so a big win runs longer), a little colour,
    // half-time and full-time.
    const [ours, theirs] = (await page.getByRole('region', { name: 'Scoreboard' }).textContent() ?? '').match(/(\d+)–(\d+)/)!.slice(1).map(Number)
    expect(await report.count()).toBeGreaterThan(2)
    expect(await report.count()).toBeLessThanOrEqual(Math.max(6, ours + theirs) + 5)
  })

  test('a goal is shown as a setup and then its outcome, with the score changing at the outcome', async ({ page }) => {
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    await kickOff(page)
    const card = page.getByRole('button', { name: 'Next moment' })
    const scoreline = page.locator('main [aria-live="polite"]')
    // The debut is a win, so there is a goal: tap until the label says so, and the score must not have moved yet.
    for (let taps = 0; taps < 12; taps++) {
      await card.click()
      if (await page.getByText('Chance', { exact: true }).isVisible())
        break
    }
    await expect(page.getByText('Chance', { exact: true })).toBeVisible()
    const before = await scoreline.textContent()
    await card.click()
    await expect(page.getByText(/^(Goal|Saved|Missed)$/)).toBeVisible()
    if (await page.getByText('Goal', { exact: true }).isVisible())
      await expect(scoreline).not.toHaveText(before!)
  })

  test('with reduced motion the report never moves on by itself: Next steps through it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await guest(page)
    await page.getByRole('button', { name: 'Found the club' }).click()
    await kickOff(page)
    const next = page.getByRole('button', { name: 'Next', exact: true })
    await expect(next).toBeVisible()
    await page.waitForTimeout(3500)
    await expect(page.getByRole('list', { name: 'Match so far' }).getByRole('listitem')).toHaveCount(0)
    for (let taps = 0; taps < 40 && await next.isVisible(); taps++)
      await next.click()
    await expect(page.getByRole('img', { name: 'win' })).toBeVisible()
  })

  test('the formation changes the lineup, the odds and the hint', async ({ page }) => {
    await foundClub(page)
    const odds = page.getByText(/^Win \d+% · Draw \d+% · Loss \d+%$/)
    const before = await odds.textContent()
    await page.getByRole('radio', { name: /Wall/ }).click()
    await expect(page.getByRole('radio', { name: /Wall/ })).toHaveAttribute('aria-checked', 'true')
    await expect(odds).not.toHaveText(before!)
    await expect(page.getByRole('button', { name: /^Switch to .+ with your best five/ }).or(page.getByText(/is your best formation against them\.$/))).toBeVisible()
  })

  test('a slot can be refilled from the squad sheet', async ({ page }) => {
    await foundClub(page)
    await page.getByRole('button', { name: /^GK: / }).click()
    const sheet = page.getByRole('dialog', { name: 'Pick a GK' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Leave this slot empty' }).click()
    await expect(page.getByRole('button', { name: 'GK: empty' })).toBeVisible()
    await page.getByRole('button', { name: 'Auto-pick' }).click()
    await expect(page.getByRole('button', { name: /^GK: .+rated/ })).toBeVisible()
  })
})

test.describe('Packs @game', () => {
  /** Founds a club and lets three hours pass, so four packs are on the shelf. */
  async function withPacks(page: Page) {
    await foundClub(page)
    await advanceClock(page, 3 * HOUR + 60_000)
    await page.goto('/packs')
    await expect(page.getByLabel('4 of 10 packs')).toBeVisible()
  }

  async function flipAll(page: Page) {
    await page.getByRole('button', { name: 'Tear open the pack' }).click()
    for (let card = 0; card < 3; card++) {
      await page.getByRole('button', { name: 'Turn the card over' }).click()
      await expect(page.getByRole('button', { name: 'Next player' })).toBeVisible()
      await (card < 2 ? page.getByRole('button', { name: 'Next', exact: true }) : page.getByRole('button', { name: 'Sign or sell' })).click()
    }
  }

  test('open a pack from the shelf, turn each card over, sign two and sell one', async ({ page }) => {
    await withPacks(page)
    await page.getByRole('button', { name: 'Open a pack' }).click()
    await expect(page.getByRole('dialog', { name: 'Open pack' })).toBeVisible()
    await flipAll(page)

    await expect(page.getByRole('heading', { name: 'Your new players' })).toBeVisible()
    const groups = page.getByRole('radiogroup', { name: /: sign or sell$/ })
    await expect(groups).toHaveCount(3)
    await groups.first().getByRole('radio', { name: /^Sell/ }).click()
    await expect(page.getByText(/Bench after signing: 2\/20/)).toBeVisible()
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    await expect(page.getByRole('dialog', { name: 'Open pack' })).toBeHidden()
    await expect(page.getByLabel('3 of 10 packs')).toBeVisible()
    await tab(page, 'Squad').click()
    await expect(page.getByRole('button', { name: 'Players (7)' })).toBeVisible()
  })

  test('the daily free pack is first on the screen and opens in one tap', async ({ page }) => {
    await foundClub(page)
    await page.goto('/packs')
    const daily = page.getByRole('region', { name: 'Daily free pack' })
    await daily.getByRole('button', { name: 'Open your free pack' }).click()
    await expect(page.getByRole('button', { name: 'Tear open the pack' })).toBeVisible()
    await page.getByRole('button', { name: 'Later' }).click()
    await expect(daily).toHaveCount(0)
  })

  test('a pack left half-opened is still waiting afterwards', async ({ page }) => {
    await withPacks(page)
    await page.getByRole('button', { name: 'Open a pack' }).click()
    await page.getByRole('button', { name: 'Later' }).click()
    await expect(page.getByText('A pack is waiting for you')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open a pack' })).toBeDisabled()
    await page.reload()
    await page.getByRole('button', { name: 'Open it' }).click()
    await expect(page.getByRole('dialog', { name: 'Open pack' })).toBeVisible()
  })

  test('shows the odds before every rip, and the Star guarantee', async ({ page }) => {
    await withPacks(page)
    const odds = page.getByRole('region', { name: 'Pack odds' })
    await expect(odds.getByText('Grassroots')).toBeVisible()
    await expect(odds.getByText('Legend')).toBeVisible()
    await expect(odds.getByText(/guaranteed within 40 players/)).toBeVisible()
  })

  test('extra packs cost coins, are limited to three a day, and arcade packs need tokens', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 2 * 24 * HOUR)
    await page.goto('/packs')
    const buy = page.getByRole('button', { name: /^Buy a pack/ })
    await expect(buy).toBeEnabled()
    await expect(page.getByText(/3 left today/)).toBeVisible()
    await buy.click()
    await flipAll(page)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByText(/2 left today/)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Arcade pack/ })).toBeDisabled()
  })
})

test.describe('Stadium, warm-up and arcade @game', () => {
  test('the stadium piles up coins while away and pays them when collected', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 3 * HOUR + 60_000)
    await page.goto('/club')
    await page.getByRole('button', { name: /^(Let's go|Not now)$/ }).click()
    const stadium = page.getByRole('region', { name: 'Stadium' })
    await expect(stadium.getByText(/Level 1/)).toBeVisible()
    const collect = stadium.getByRole('button', { name: /^Collect 1[89]\d$/ })
    await expect(collect).toBeEnabled()
    await collect.click()
    await expect(stadium.getByRole('button', { name: /^Collect 0$/ })).toBeDisabled()
  })

  test('the stadium can be upgraded once the club can pay', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 4 * 24 * HOUR)
    await page.goto('/club')
    await page.getByRole('button', { name: /^(Let's go|Not now)$/ }).click()
    const stadium = page.getByRole('region', { name: 'Stadium' })
    const upgrade = stadium.getByRole('button', { name: /^Upgrade/ })
    await expect(upgrade).toBeEnabled()
    await upgrade.click()
    await expect(stadium.getByText(/Level 2/)).toBeVisible()
  })

  test('the warm-up is a free play of one arcade game, once a match, and the result is kept', async ({ page }) => {
    test.setTimeout(90_000)
    await foundClub(page)
    await page.goto('/arcade')
    const tray = page.getByRole('region', { name: 'Token tray' })
    const tokensBefore = await tray.getByText(/^You have \d+\./).textContent()
    await page.goto('/club')
    const match = page.getByRole('region', { name: 'Next match' })
    await match.getByRole('button', { name: 'Warm up' }).click()
    const warmup = page.getByRole('dialog', { name: 'Warm-up' })
    await expect(warmup.getByRole('heading', { name: /^Today's warm-up: (Kick Timer|Keepy-Uppy|Penalty Shootout|Keeper Reflex|Dribble Dash)$/ })).toBeVisible()
    await expect(warmup.getByText('Score 80%+ for +10% attack, 45%+ for +5%, anything else +2%.')).toBeVisible()
    await playWarmup(page)
    await expect(warmup.getByText(/^(Kick Timer|Keepy-Uppy|Penalty Shootout|Keeper Reflex|Dribble Dash): \d+ of \d+ \(\d+%\)$/)).toBeVisible()
    await expect(warmup.getByRole('status')).toHaveText(/^(Gold!|Good warm-up|Not your best)$/)
    await expect(warmup.getByText(/^\+(10|5|2)% attack in your next league match only\.$/)).toBeVisible()
    await warmup.getByRole('button', { name: 'Done' }).click()
    // One try a match: the card now shows what it gave instead of offering another.
    await expect(match.getByRole('button', { name: 'Warm up' })).toHaveCount(0)
    await expect(match.getByRole('button', { name: /^Warmed up: \+(10|5|2)% attack$/ })).toBeVisible()
    // It cost no energy and paid no tokens.
    await page.goto('/arcade')
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('5 / 5')).toBeVisible()
    await expect(tray.getByText(/^You have \d+\./)).toHaveText(tokensBefore!)
  })

  test('Kick Timer: five kicks, scored by the server, paying tokens, and costing one energy', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/arcade')
    await expect(page.getByRole('region', { name: 'Token tray' }).getByText(/Tray: 0 tokens/)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('5 / 5')).toBeVisible()
    await page.getByRole('region', { name: 'Kick Timer' }).getByRole('link', { name: /Play · 1 energy/ }).click()
    await page.getByRole('button', { name: /^Start/ }).click()
    for (let kick = 1; kick <= 5; kick++) {
      await expect(page.getByText(`Kick ${kick} of 5`)).toBeVisible()
      // The last round is always fast, and the screen says so before the kick.
      if (kick === 5)
        await expect(page.getByText(/Fast!/)).toBeVisible()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'KICK!' }).click()
      await expect(page.getByText(/^(Miss|Close|Good|Perfect!)( ×2)?$/)).toBeVisible()
    }
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 10_000 })
    // The sum is spelled out: the score, the most it could be, and the tokens it paid.
    await expect(result.getByText(/^Score \d+ of 27 → \d+ tokens$/)).toBeVisible()
    // The play is scored against the best so far, and offers another go, with the energy left.
    await expect(result.getByRole('status')).toHaveText(/best|board|Level|off your/i)
    await expect(page.getByRole('button', { name: /Play again · 4 energy left/ })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the arcade' }).click()
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('4 / 5')).toBeVisible()
  })

  test('Penalty Shootout: five shots against a keeper, scored by the server, sharing the same energy', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/arcade')
    await expect(page.getByRole('region', { name: 'Penalty Shootout' }).getByText(/Not played yet/)).toBeVisible()
    await page.getByRole('region', { name: 'Penalty Shootout' }).getByRole('link', { name: /Play · 1 energy/ }).click()
    await page.getByRole('button', { name: /^Start/ }).click()
    for (let penalty = 1; penalty <= 5; penalty++) {
      await expect(page.getByText(`Penalty ${penalty} of 5`)).toBeVisible()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'SHOOT!' }).click()
      await expect(page.getByText(/^(Wide!|Over the bar!|Saved!|Goal!|Corner! 2 points)$/)).toBeVisible()
    }
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 10_000 })
    await expect(result.getByText(/^Score \d+ of 10 → \d+ tokens$/)).toBeVisible()
    await page.getByRole('link', { name: 'Back to the arcade' }).click()
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('4 / 5')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Penalty Shootout' }).getByText(/(Best: \d+ \/ 10|Not played yet)/)).toBeVisible()
  })

  test('Keepy-Uppy: the ball drops with no taps, and the server scores the play', async ({ page }) => {
    test.setTimeout(60_000)
    await foundClub(page)
    await page.goto('/arcade/keepy')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByLabel('Keepy-Uppy game')).toBeVisible()
    await expect(page.getByText('30s')).toBeVisible()
    const result = page.getByLabel('Result')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await expect(result.getByText('Score 0 of 33 → 0 tokens')).toBeVisible()
    await expect(result.getByText(/Nothing this time/)).toBeVisible()
  })

  test('the arcade tray fills while away and is collected into tokens', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 5 * HOUR)
    await page.goto('/arcade')
    const tray = page.getByRole('region', { name: 'Token tray' })
    await expect(tray.getByText(/Tray: 1[12]\d tokens/)).toBeVisible()
    await tray.getByRole('button', { name: 'Collect' }).click()
    await expect(tray.getByText(/Tray: 0 tokens/)).toBeVisible()
    await expect(tray.getByText(/You have 1[12]\d\./)).toBeVisible()
  })

  test('energy runs out after five plays, comes back one at a time, and an extra play costs gems', async ({ page }) => {
    test.setTimeout(90_000)
    await foundClub(page)
    for (let play = 0; play < 5; play++) {
      await page.goto('/arcade/keepy')
      await page.getByRole('button', { name: /^Start/ }).click()
      await expect(page.getByLabel('Result')).toBeVisible({ timeout: 20_000 })
    }
    await page.goto('/arcade')
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('0 / 5')).toBeVisible()
    const keepy = page.getByRole('region', { name: 'Keepy-Uppy' })
    await expect(page.getByText(/^Out of energy/)).toBeVisible()
    await expect(keepy.getByRole('link', { name: /Extra play · 20 gems/ })).toBeVisible()
    // The other game shares the same bar.
    await expect(page.getByRole('region', { name: 'Kick Timer' }).getByRole('link', { name: /Play · 1 energy/ })).toHaveCount(0)

    // One point comes back after 90 minutes.
    await advanceClock(page, 90 * 60_000)
    await page.goto('/arcade')
    await expect(page.getByRole('region', { name: 'Energy' }).getByText('1 / 5')).toBeVisible()
    await expect(keepy.getByRole('link', { name: /Play · 1 energy/ })).toBeVisible()
  })

  test('one game a day pays extra tokens, and each game shows your best', async ({ page }) => {
    await foundClub(page)
    await page.goto('/arcade')
    await expect(page.getByText(/Today \+50% tokens/)).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Keepy-Uppy' }).getByText('Not played yet')).toBeVisible()
    await page.goto('/arcade/keepy')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 20_000 })
    // No kicks scored, so nothing is on the board; a later play with taps would set a best.
    await expect(page.getByRole('status').filter({ hasText: /Nothing on the board/ })).toBeVisible()
  })

  test('the welcome-back summary mentions the stadium and the arcade', async ({ page }) => {
    await foundClub(page)
    await advanceClock(page, 6 * HOUR)
    await page.goto('/club')
    const welcome = page.getByRole('dialog', { name: 'Welcome back' })
    await expect(welcome.getByText(/coins waiting in the stadium/)).toBeVisible()
    await expect(welcome.getByText(/tokens waiting in the arcade/)).toBeVisible()
  })
})

test.describe('Goals, Pass and album @game', () => {
  test('the hub shows what is waiting to be claimed', async ({ page }) => {
    await foundClub(page)
    await page.goto('/club')
    // A new club can take its first calendar day on Goals; its free pack is on the Packs tile.
    await expect(page.getByRole('link', { name: /^Goals/ }).getByLabel(/to claim$/)).toHaveText('1')
    await expect(page.getByRole('navigation', { name: 'More to do' }).getByRole('button', { name: /Daily pack/ })).toBeVisible()
  })

  test('three goals a day, a free pack each day, and a login calendar that moves on each day', async ({ page }) => {
    await foundClub(page)
    await page.goto('/goals')
    const goals = page.getByRole('region', { name: 'Daily goals' })
    await expect(goals.getByRole('listitem')).toHaveCount(3)
    // A goal not yet done goes to where it is done, instead of a Claim button that does nothing.
    await expect(goals.getByRole('button', { name: 'Claim' })).toHaveCount(0)
    await expect(goals.getByRole('link', { name: /›$/ })).toHaveCount(3)

    // The free pack is on the Packs screen, and opens straight away.
    await page.goto('/packs')
    await page.getByRole('button', { name: 'Open your free pack' }).click()
    await expect(page.getByRole('button', { name: 'Tear open the pack' })).toBeVisible()
    await page.getByRole('button', { name: 'Later' }).click()
    await expect(page.getByRole('region', { name: 'Daily free pack' })).toHaveCount(0)
    await page.goto('/goals')
    await page.getByRole('button', { name: /^Claim day 1/ }).click()
    await expect(page.getByRole('button', { name: /Claimed today/ })).toBeDisabled()
    await expect(page.getByLabel('Day 1, claimed')).toBeVisible()

    // The free pack was opened and left for later, so it is the one waiting.
    await page.goto('/packs')
    await expect(page.getByText('A pack is waiting for you')).toBeVisible()

    await advanceClock(page, 24 * HOUR + 60_000)
    await page.goto('/packs')
    await expect(page.getByRole('button', { name: 'Open your free pack' })).toBeVisible()
    await page.goto('/goals')
    await expect(page.getByRole('button', { name: /^Claim day 2/ })).toBeEnabled()
    await page.getByRole('button', { name: /^Claim day 2/ }).click()
    await expect(page.getByLabel('Day 2, claimed')).toBeVisible()
  })

  test('a missed day starts the calendar again', async ({ page }) => {
    await foundClub(page)
    await page.goto('/goals')
    await page.getByRole('button', { name: /^Claim day 1/ }).click()
    await advanceClock(page, 3 * 24 * HOUR)
    await page.goto('/goals')
    await expect(page.getByRole('button', { name: /^Claim day 1/ })).toBeEnabled()
  })

  test('the League Pass fills with XP from matches, and its premium track needs the Pass', async ({ page }) => {
    await foundClub(page)
    // 56 matches (the most one catch-up plays) at 2 XP, and a bit more for each win, is over a tier.
    await advanceClock(page, 7 * 24 * HOUR)
    await page.goto('/pass')
    await expect(page.getByText(/^Tier [1-9]\d? \/ 30$/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Tiers' }).getByRole('listitem')).toHaveCount(30)
    await expect(page.getByLabel('Tier 1 League Pass reward').getByText('Needs the League Pass')).toBeVisible()
    // Every free tier pays something.
    await expect(page.getByLabel(/^Tier \d+ free reward$/).getByText('None')).toHaveCount(0)

    await page.evaluate(() => window.__pixelPitchClock!.setPass(true))
    await page.reload()
    await page.getByRole('button', { name: 'Claim premium tier 1' }).click()
    await expect(page.getByLabel('Tier 1 League Pass reward').getByText('Claimed')).toBeVisible()
    await expect(page.getByText(/League Pass active/)).toBeVisible()
  })

  test('the album lists sets of six, with the starter players already collected', async ({ page }) => {
    await foundClub(page)
    await page.goto('/album')
    await expect(page.getByText(/^0 \/ \d+ sets$/)).toBeVisible()
    await expect(page.getByText('Team power +0%')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Northvale' })).toBeVisible()
    // The starter players are collected. A few of the weakest players are in no set, so up to five slots are filled in.
    await expect(page.locator('[aria-label="Not collected yet"]').first()).toBeVisible()
    const collected = await page.locator('li[aria-label]:not([aria-label="Not collected yet"])').evaluateAll(items => items.filter(item => item.closest('ul')?.className.includes('grid-cols-6')).length)
    expect(collected).toBeLessThanOrEqual(5)
  })
})

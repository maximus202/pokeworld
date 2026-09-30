import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { card, cards, expect, openPanel, test } from './helpers'

/** Presses Tab until the locator has focus, so the test proves it can be reached from the keyboard. */
async function tabTo(page: Page, locator: ReturnType<Page['locator']>, max = 30) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate(el => el === document.activeElement).catch(() => false)) return
  }
  throw new Error(`Tab never reached ${locator} in ${max} presses`)
}

const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))))
const violations = async (page: Page) => {
  await settled(page) // a dialog that is still fading in has colours halfway between the two
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations
    .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe scan, ${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test('browse', async ({ page }) => {
      await page.goto('/')
      await page.request.put('/api/collection/bulbasaur')
      await page.reload()
      await expect(card(page, 'bulbasaur').getByTestId('caught-badge')).toBeVisible()
      expect(await violations(page)).toEqual([])
    })

    test('the details panel', async ({ page }) => {
      await page.goto('/?pokemon=bulbasaur')
      await expect(page.getByTestId('panel-name')).toBeVisible()
      expect(await violations(page)).toEqual([])
    })

    test('My Collection, with a card, and empty', async ({ page }) => {
      await page.goto('/collection')
      await expect(page.getByTestId('collection-empty')).toBeVisible()
      expect(await violations(page)).toEqual([])

      await page.request.put('/api/collection/lotad')
      await page.reload()
      await expect(cards(page)).toHaveCount(1)
      expect(await violations(page)).toEqual([])
    })

    test('the reset dialog', async ({ page }) => {
      await page.goto('/')
      await page.getByTestId('reset-button').click()
      await expect(page.getByTestId('reset-confirm')).toBeVisible()
      expect(await violations(page)).toEqual([])
    })

    test('the no-results state', async ({ page }) => {
      await page.goto('/?q=zzz')
      await expect(page.getByTestId('no-matches')).toBeVisible()
      expect(await violations(page)).toEqual([])
    })
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

  test('the main flow works, and nothing scrolls sideways', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Search Pokemon by name' }).fill('bulb')
    await expect(cards(page)).toHaveCount(1)
    expect(await overflow(page)).toBeLessThanOrEqual(0)

    await card(page, 'bulbasaur').locator('a').tap()
    await expect(page.getByTestId('panel-name')).toHaveText('Bulbasaur')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await page.getByTestId('catch-toggle').tap()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.getByRole('button', { name: 'Close' }).tap()

    await page.getByTestId('collection-link').tap()
    await expect(card(page, 'bulbasaur')).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'Remove Bulbasaur' }).tap()
    await expect(page.getByTestId('collection-empty')).toBeVisible()
  })
})

test.describe('with only a keyboard', () => {
  test('the first Tab stop is a link that skips to the content', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')

    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  })

  test('a card can be opened and a Pokemon caught, all from the keyboard', async ({ page }) => {
    await page.goto('/')

    await tabTo(page, card(page, 'bulbasaur').locator('a'))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('panel-name')).toHaveText('Bulbasaur')

    await tabTo(page, page.getByTestId('catch-toggle'))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await expect(page.getByTestId('collection-link')).toHaveText('My Collection (1)')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('panel-name')).toBeHidden()
    await expect(page).not.toHaveURL(/pokemon=/)
  })

  test('removing a Pokemon from the grid leaves focus on the page heading, not lost', async ({ page }) => {
    await page.goto('/')
    await page.request.put('/api/collection/bulbasaur')
    await page.request.put('/api/collection/lotad')
    await page.goto('/collection')

    await tabTo(page, page.getByRole('button', { name: 'Remove Lotad' }))
    await page.keyboard.press('Enter')

    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'My Collection' })).toBeFocused()
  })

  test('the reset dialog is reachable and can be cancelled with the keyboard', async ({ page }) => {
    await page.goto('/')
    await page.request.put('/api/collection/lotad')
    await page.reload()

    await tabTo(page, page.getByTestId('reset-button'))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('reset-confirm')).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('reset-confirm')).toBeHidden()
    await expect(page.getByTestId('collection-link')).toHaveText('My Collection (1)')
  })
})

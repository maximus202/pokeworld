import { expect, test as base, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { fixtureControl } from '../fixtures/server'
import { FIXTURE_PORT } from '../../playwright.config'

const fixture = fixtureControl(`http://127.0.0.1:${FIXTURE_PORT}`)

// 1x1 transparent PNG: the app hot-links artwork from GitHub, which tests must not depend on.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function stubImages(context: BrowserContext) {
  await context.route(/raw\.githubusercontent\.com|example\.test/, route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
}

const test = base.extend({
  context: async ({ context }, use) => {
    await stubImages(context)
    await use(context)
  }
})

/** Navigates and waits for Vue to hydrate, so early clicks are not lost. */
async function open(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
}

const card = (page: Page, name: string) => page.getByTestId(`pokemon-card-${name}`)
const cards = (page: Page) => page.locator('[data-testid^="pokemon-card-"]')
// By test id, not role: while the details panel is open the page behind it is aria-hidden.
const navCount = (page: Page, n: number) => page.getByTestId('nav-link').filter({ hasText: `My Collection (${n})` })
const today = () => new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })

async function openPanel(page: Page, name: string) {
  await card(page, name).getByRole('link').click()
  await expect(page.getByTestId('pokemon-panel')).toBeVisible()
  await expect(page.getByTestId('panel-name')).toHaveText(new RegExp(name.replace('-', ' '), 'i'))
}

async function catchViaPanel(page: Page, name: string) {
  await openPanel(page, name)
  await page.getByTestId('catch-toggle').click()
  await expect(page.getByTestId('catch-toggle')).toContainText('Remove')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pokemon-panel')).toBeHidden()
}

test.beforeEach(async () => {
  await fixture.reset()
})

test.describe('browse', () => {
  test('lists Pokemon with a Load more control that shows how many are left', async ({ page }) => {
    await open(page)
    await expect(cards(page)).toHaveCount(24)
    await expect(card(page, 'bulbasaur')).toContainText('#0001')
    await expect(card(page, 'bulbasaur')).toContainText('Bulbasaur')

    await expect(page.getByTestId('load-more')).toHaveText('Load more (6 left)')
    await page.getByTestId('load-more').click()
    await expect(cards(page)).toHaveCount(30)
    await expect(page.getByTestId('load-more')).toBeHidden()
  })

  test('searches by name, keeps the search in the URL, and clears it', async ({ page }) => {
    await open(page)
    await page.getByTestId('search-input').fill('BULB')
    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, 'bulbasaur')).toBeVisible()
    await expect(page).toHaveURL(/q=BULB/i)

    await page.reload()
    await expect(page.getByTestId('search-input')).toHaveValue(/bulb/i)
    await expect(cards(page)).toHaveCount(1)

    await page.getByTestId('search-clear').click()
    await expect(cards(page)).toHaveCount(24)
    await expect(page).not.toHaveURL(/q=/)
  })

  test('shows "No matches" for a search with no results and clears the filters', async ({ page }) => {
    await open(page)
    await page.getByTestId('search-input').fill('zzzz')
    await expect(page.getByTestId('no-matches')).toContainText('zzzz')
    await page.getByTestId('clear-filters').click()
    await expect(cards(page)).toHaveCount(24)
  })

  test('filters by type, including dual types, combined with search, and survives a reload', async ({ page }) => {
    await open(page)
    await page.getByTestId('type-filter').click()
    await page.getByRole('option', { name: 'Grass' }).click()
    await expect(cards(page)).toHaveCount(6)
    await expect(card(page, 'lotad')).toBeVisible() // water/grass: grass is its second type
    await expect(page).toHaveURL(/type=grass/)

    await page.reload()
    await expect(cards(page)).toHaveCount(6)

    await page.getByTestId('search-input').fill('bulb')
    await expect(cards(page)).toHaveCount(1)
  })

  test('shows a list error with Try again, and recovers', async ({ page }) => {
    await open(page)
    // failAll, not failNext: the browser retries a failed request once on its own.
    await fixture.failAll()
    await page.getByTestId('type-filter').click()
    await page.getByRole('option', { name: 'Poison' }).click()
    await expect(page.getByTestId('list-error')).toBeVisible()

    await fixture.failAll(false)
    await page.getByTestId('list-retry').click()
    await expect(cards(page)).toHaveCount(3)
    await expect(page.getByTestId('list-error')).toBeHidden()
  })
})

test.describe('shiny form', () => {
  test('grass Pokemon show the shiny badge in the list, and other Pokemon do not', async ({ page }) => {
    await open(page)
    await expect(card(page, 'bulbasaur').getByTestId('shiny-badge')).toBeVisible() // grass primary
    await expect(card(page, 'lotad').getByTestId('shiny-badge')).toBeVisible() // grass secondary
    await expect(card(page, 'charmander').getByTestId('shiny-badge')).toHaveCount(0)
    await expect(card(page, 'bulbasaur').locator('img')).toHaveAttribute('src', /\/shiny\/1\.png$/)
    await expect(card(page, 'charmander').locator('img')).toHaveAttribute('src', /\/official-artwork\/4\.png$/)
  })

  test('the details panel shows the shiny form for grass, and the default form otherwise', async ({ page }) => {
    await open(page)
    await openPanel(page, 'lotad')
    await expect(page.getByTestId('pokemon-panel').getByTestId('shiny-badge')).toBeVisible()
    await page.keyboard.press('Escape')

    await openPanel(page, 'charmander')
    await expect(page.getByTestId('pokemon-panel').getByTestId('shiny-badge')).toHaveCount(0)
  })

  test('falls back to the default image when the shiny one cannot be loaded', async ({ page }) => {
    await page.route(/shiny\/1\.png/, route => route.fulfill({ status: 404 }))
    await open(page)
    const bulbasaur = card(page, 'bulbasaur')
    await expect(bulbasaur.locator('img')).toHaveAttribute('src', /official-artwork\/1\.png$/)
    await expect(bulbasaur.getByTestId('shiny-badge')).toHaveCount(0)
  })
})

test.describe('details panel', () => {
  test('opens from a card with name, height, types and abilities, and closes back to the list', async ({ page }) => {
    await open(page)
    await openPanel(page, 'bulbasaur')
    await expect(page).toHaveURL(/pokemon=bulbasaur/)
    await expect(page.getByTestId('panel-name')).toHaveText('Bulbasaur')
    await expect(page.getByTestId('panel-height')).toHaveText('0.7 m (2′04″)')
    await expect(page.getByTestId('panel-abilities')).toContainText('Overgrow')
    await expect(page.getByTestId('panel-types')).toContainText('Grass')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('pokemon-panel')).toBeHidden()
    await expect(page).not.toHaveURL(/pokemon=/)
    await expect(cards(page)).toHaveCount(24)
  })

  test('a shared link reloads straight into the panel', async ({ page }) => {
    await open(page, '/?pokemon=charmander')
    await expect(page.getByTestId('panel-name')).toHaveText('Charmander')
  })

  test('shows an error with Try again when the details cannot be loaded', async ({ page }) => {
    await open(page)
    await fixture.failAll()
    await card(page, 'spriteonly').getByRole('link').click()
    await expect(page.getByTestId('panel-error')).toBeVisible()
    await expect(page.getByTestId('catch-toggle')).toHaveCount(0)

    await fixture.failAll(false)
    await page.getByTestId('panel-retry').click()
    await expect(page.getByTestId('panel-name')).toHaveText('Spriteonly')
  })

  test('shows "not found" for an unknown Pokemon', async ({ page }) => {
    await open(page, '/?pokemon=missingno')
    await expect(page.getByTestId('panel-error')).toContainText('Pokemon not found')
  })
})

test.describe('collection', () => {
  test('catching shows Remove, the count, the caught date on the card and in the panel', async ({ page }) => {
    await open(page)
    await expect(navCount(page, 0)).toBeVisible()

    await openPanel(page, 'bulbasaur')
    await expect(page.getByTestId('catch-toggle')).toContainText('Catch')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toContainText('Remove')
    await expect(page.getByTestId('panel-caught-date')).toHaveText(today())
    await expect(navCount(page, 1)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(card(page, 'bulbasaur').getByTestId('caught-badge')).toBeVisible()

    await navCount(page, 1).click()
    await expect(card(page, 'bulbasaur')).toContainText(`Caught ${today()}`)
  })

  test('lists the most recently caught first', async ({ page }) => {
    await open(page)
    await catchViaPanel(page, 'bulbasaur')
    await page.waitForTimeout(20)
    await catchViaPanel(page, 'charmander')

    await navCount(page, 2).click()
    await expect(page.getByTestId('collection-list')).toBeVisible()
    const names = await page.locator('[data-testid="collection-list"] [data-testid^="pokemon-card-"]').evaluateAll(
      els => els.map(el => el.getAttribute('data-testid'))
    )
    expect(names).toEqual(['pokemon-card-charmander', 'pokemon-card-bulbasaur'])
  })

  test('shows an empty state with a way to browse', async ({ page }) => {
    await open(page, '/collection')
    await expect(page.getByTestId('collection-empty')).toBeVisible()
    await page.getByRole('link', { name: 'Browse Pokemon' }).click()
    await expect(cards(page)).toHaveCount(24)
  })

  test('removes a Pokemon from the panel', async ({ page }) => {
    await open(page)
    await catchViaPanel(page, 'squirtle')
    await openPanel(page, 'squirtle')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toContainText('Catch')
    await expect(page.getByTestId('panel-caught-date')).toHaveCount(0)
    await expect(navCount(page, 0)).toBeVisible()
  })

  test('removes a Pokemon straight from the collection grid', async ({ page }) => {
    await open(page)
    await catchViaPanel(page, 'squirtle')
    await catchViaPanel(page, 'charmander')
    await navCount(page, 2).click()

    await page.getByRole('button', { name: 'Remove Squirtle' }).click()
    await expect(card(page, 'squirtle')).toHaveCount(0)
    await expect(card(page, 'charmander')).toBeVisible()
    await expect(navCount(page, 1)).toBeVisible()
    await expect(page.getByTestId('pokemon-panel')).toHaveCount(0)
  })

  test('"Caught only" limits browsing to what I caught, with search and type', async ({ page }) => {
    await open(page)
    await catchViaPanel(page, 'bulbasaur')
    await catchViaPanel(page, 'lotad')
    await catchViaPanel(page, 'charmander')

    await page.getByRole('switch', { name: 'Caught only' }).click()
    await expect(cards(page)).toHaveCount(3)
    await expect(page).toHaveURL(/caught=true/)

    await page.getByTestId('search-input').fill('char')
    await expect(cards(page)).toHaveCount(1)
    await page.getByTestId('search-clear').click()

    await page.getByTestId('type-filter').click()
    await page.getByRole('option', { name: 'Grass' }).click()
    await expect(cards(page)).toHaveCount(2)

    await page.reload()
    await expect(cards(page)).toHaveCount(2)
    await expect(page.getByRole('switch', { name: 'Caught only' })).toBeChecked()
  })

  test('"Caught only" shows a prompt when nothing has been caught', async ({ page }) => {
    await open(page, '/?caught=true')
    await expect(page.getByTestId('caught-empty')).toBeVisible()
    await page.getByRole('button', { name: 'Show all Pokemon' }).click()
    await expect(cards(page)).toHaveCount(24)
  })

  test('the collection and its count survive a reload, and the count is rendered by the server', async ({ page, context }) => {
    await open(page)
    await catchViaPanel(page, 'bulbasaur')
    await page.reload()
    await expect(navCount(page, 1)).toBeVisible()

    // The first HTML the server sends already has the right count: no flash of "(0)".
    const html = await (await context.request.get('/')).text()
    expect(html).toContain('My Collection (1)')
    await open(page, '/collection')
    await expect(card(page, 'bulbasaur')).toContainText(`Caught ${today()}`)
  })

  test.describe('reset', () => {
    test('cancelling changes nothing, confirming empties the collection', async ({ page }) => {
      await open(page)
      await catchViaPanel(page, 'bulbasaur')

      await page.getByTestId('reset-button').click()
      await page.getByTestId('reset-cancel').click()
      await expect(navCount(page, 1)).toBeVisible()

      await page.getByTestId('reset-button').click()
      await page.getByTestId('reset-confirm').click()
      await expect(navCount(page, 0)).toBeVisible()
      await expect(card(page, 'bulbasaur').getByTestId('caught-badge')).toHaveCount(0)
      await navCount(page, 0).click()
      await expect(page.getByTestId('collection-empty')).toBeVisible()
    })

    test('shows an error and keeps the collection when the reset fails', async ({ page }) => {
      await open(page)
      await catchViaPanel(page, 'bulbasaur')

      await page.route('**/api/collection', route =>
        route.request().method() === 'DELETE' ? route.fulfill({ status: 500, body: '{}' }) : route.continue())
      await page.getByTestId('reset-button').click()
      await page.getByTestId('reset-confirm').click()
      await expect(page.getByTestId('reset-error')).toBeVisible()
      await expect(navCount(page, 1)).toBeVisible()
    })
  })

  test('shows a toast and changes nothing when a catch fails', async ({ page }) => {
    await open(page)
    await openPanel(page, 'bulbasaur')
    await page.route('**/api/collection/bulbasaur', route => route.fulfill({ status: 500, body: '{}' }))
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByText('Couldn\'t catch that Pokemon')).toBeVisible()
    await expect(page.getByTestId('catch-toggle')).toContainText('Catch')
    await expect(navCount(page, 0)).toBeVisible()
  })
})

test.describe('private collections', () => {
  async function newVisitor(browser: Browser) {
    const context = await browser.newContext()
    await stubImages(context)
    const page = await context.newPage()
    await open(page)
    return { context, page }
  }

  test('two browsers get different labels and never see each other\'s catches', async ({ browser }) => {
    const a = await newVisitor(browser)
    const b = await newVisitor(browser)

    const labelA = await a.page.getByTestId('visitor-label').textContent()
    const labelB = await b.page.getByTestId('visitor-label').textContent()
    expect(labelA).toMatch(/^Trainer #[0-9a-f]{4}$/)
    expect(labelB).toMatch(/^Trainer #[0-9a-f]{4}$/)
    expect(labelA).not.toBe(labelB)

    await catchViaPanel(a.page, 'bulbasaur')
    await b.page.reload()
    await expect(navCount(b.page, 0)).toBeVisible()
    await expect(card(b.page, 'bulbasaur').getByTestId('caught-badge')).toHaveCount(0)

    await catchViaPanel(b.page, 'charmander')
    await a.page.reload()
    await expect(navCount(a.page, 1)).toBeVisible()
    await open(a.page, '/collection')
    await expect(card(a.page, 'bulbasaur')).toBeVisible()
    await expect(card(a.page, 'charmander')).toHaveCount(0)

    // Each keeps its own label and collection across a reload.
    await a.page.reload()
    await b.page.reload()
    await expect(a.page.getByTestId('visitor-label')).toHaveText(labelA!)
    await expect(b.page.getByTestId('visitor-label')).toHaveText(labelB!)
    await expect(navCount(b.page, 1)).toBeVisible()

    await a.context.close()
    await b.context.close()
  })

  test('the label rendered by the server matches the cookie it issues on a first visit', async ({ browser }) => {
    const context = await browser.newContext()
    const res = await context.request.get('/')
    const id = res.headers()['set-cookie']!.match(/pokeworld_visitor=([^;]+)/)![1]!
    expect(await res.text()).toContain(`Trainer #${id.slice(0, 4)}`)
    await context.close()
  })
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('browse, open a Pokemon, catch it and see it in the collection without side-scrolling', async ({ page }) => {
    await open(page)
    await expect(cards(page).first()).toBeVisible()
    await catchViaPanel(page, 'bulbasaur')
    await navCount(page, 1).click()
    await expect(card(page, 'bulbasaur')).toContainText(`Caught ${today()}`)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('keyboard', () => {
  test('a card opens with Enter, and the catch button works with the keyboard', async ({ page }) => {
    await open(page)
    await card(page, 'charmander').getByRole('link').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('pokemon-panel')).toBeVisible()

    await page.getByTestId('catch-toggle').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('catch-toggle')).toContainText('Remove')
    await expect(navCount(page, 1)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('pokemon-panel')).toBeHidden()
  })
})

import { expect, test as base, type Browser, type Page } from '@playwright/test'

// 1x1 transparent PNG. Sprites come from GitHub in the browser, which tests must not hit.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('https://raw.githubusercontent.com/**', route =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
    await use(context)
  }
})

const card = (page: Page, name: string) => page.getByTestId(`pokemon-card-${name}`)
const panel = (page: Page) => page.getByTestId('pokemon-panel')

async function open(page: Page, name: string) {
  await card(page, name).click()
  await expect(panel(page)).toBeVisible()
}

async function newVisitorPage(browser: Browser) {
  const context = await browser.newContext()
  await context.route('https://raw.githubusercontent.com/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByTestId('visitor-label')).toHaveText(/Trainer #[0-9a-f]{4}/)
  return { context, page }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('visitor-label')).toHaveText(/Trainer #[0-9a-f]{4}/)
})

test.describe('list and search', () => {
  test('lists the fixture Pokemon', async ({ page }) => {
    await expect(page.getByTestId('pokemon-list').locator('a')).toHaveCount(8)
    await expect(card(page, 'bulbasaur')).toContainText('Bulbasaur')
    await expect(card(page, 'charmander')).toBeVisible()
  })

  test('typing filters the list, a bad name shows "no matches", and clearing restores it', async ({ page }) => {
    const search = page.getByTestId('search-input')

    await search.fill('BULB')
    await expect(page.getByTestId('pokemon-list').locator('a')).toHaveCount(1)
    await expect(card(page, 'bulbasaur')).toBeVisible()

    await search.fill('zzzzz')
    await expect(page.getByTestId('no-matches')).toBeVisible()

    await page.getByTestId('search-clear').click()
    await expect(page.getByTestId('pokemon-list').locator('a')).toHaveCount(8)
  })
})

test.describe('details side panel', () => {
  test('opens with name, height and abilities, and closing returns to the list', async ({ page }) => {
    await open(page, 'bulbasaur')
    await expect(page.getByTestId('panel-name')).toHaveText('Bulbasaur')
    await expect(page.getByTestId('panel-height')).toContainText('0.7 m')
    await expect(page.getByTestId('panel-abilities')).toContainText('Overgrow')
    await expect(page.getByTestId('panel-abilities')).toContainText('Chlorophyll')
    await expect(panel(page).locator('img')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
    await expect(page).not.toHaveURL(/pokemon=/)
    await expect(page.getByTestId('pokemon-list')).toBeVisible()
  })

  test('keeps the search when the panel closes', async ({ page }) => {
    await page.getByTestId('search-input').fill('char')
    await expect(page.getByTestId('pokemon-list').locator('a')).toHaveCount(3)
    await open(page, 'charmander')
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
    await expect(page.getByTestId('search-input')).toHaveValue('char')
    await expect(page.getByTestId('pokemon-list').locator('a')).toHaveCount(3)
  })

  test('deep-links straight to a Pokemon', async ({ page }) => {
    await page.goto('/?pokemon=lotad')
    await expect(page.getByTestId('panel-name')).toHaveText('Lotad')
  })

  test('shows a friendly message for an unknown Pokemon', async ({ page }) => {
    await page.goto('/?pokemon=notapokemon')
    await expect(page.getByTestId('panel-error')).toBeVisible()
  })
})

test.describe('shiny for grass types', () => {
  test('grass as primary type (bulbasaur) shows the shiny badge in list and panel', async ({ page }) => {
    await expect(card(page, 'bulbasaur').getByTestId('shiny-badge')).toBeVisible()
    await open(page, 'bulbasaur')
    await expect(panel(page).getByTestId('shiny-badge')).toBeVisible()
    await expect(panel(page).locator('img')).toHaveAttribute('src', /official-artwork\/shiny\/1\.png/)
  })

  test('grass as secondary type (lotad) shows the shiny badge', async ({ page }) => {
    await expect(card(page, 'lotad').getByTestId('shiny-badge')).toBeVisible()
    await open(page, 'lotad')
    await expect(panel(page).getByTestId('shiny-badge')).toBeVisible()
  })

  test('non-grass (charmander) shows the default image and no badge', async ({ page }) => {
    await expect(card(page, 'charmander').getByTestId('shiny-badge')).toHaveCount(0)
    await open(page, 'charmander')
    await expect(panel(page).getByTestId('shiny-badge')).toHaveCount(0)
    await expect(panel(page).locator('img')).toHaveAttribute('src', /official-artwork\/4\.png/)
  })

  test('falls back to the plain sprite without official artwork', async ({ page }) => {
    await open(page, 'spriteonly')
    await expect(panel(page).locator('img')).toHaveAttribute('src', /pokemon\/9001\.png/)
  })
})

test.describe('collection', () => {
  test('catch flips the button to Remove and the Pokemon appears in My Collection', async ({ page }) => {
    await open(page, 'charmander')
    const toggle = page.getByTestId('catch-toggle')
    await expect(toggle).toHaveText('Catch')
    await toggle.click()
    await expect(toggle).toHaveText('Remove')
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: /My Collection/ }).click()
    await expect(page.getByTestId('collection-list').locator('a')).toHaveCount(1)
    await expect(card(page, 'charmander')).toBeVisible()
  })

  test('a Pokemon can be removed by opening it from My Collection', async ({ page }) => {
    await open(page, 'lotad')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: /My Collection/ }).click()
    await card(page, 'lotad').click()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Catch')
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('collection-empty')).toBeVisible()
  })

  test('the collection shows shiny for caught grass Pokemon', async ({ page }) => {
    await open(page, 'bulbasaur')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: /My Collection/ }).click()
    await expect(card(page, 'bulbasaur').getByTestId('shiny-badge')).toBeVisible()
  })

  test('reset: cancelling does nothing, confirming empties the collection', async ({ page }) => {
    await open(page, 'charmander')
    await page.getByTestId('catch-toggle').click()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.keyboard.press('Escape')

    await page.getByTestId('reset-button').click()
    await page.getByTestId('reset-cancel').click()
    await page.getByRole('link', { name: /My Collection \(1\)/ }).click()
    await expect(card(page, 'charmander')).toBeVisible()

    await page.getByTestId('reset-button').click()
    await page.getByTestId('reset-confirm').click()
    await expect(page.getByTestId('collection-empty')).toBeVisible()

    await page.goto('/?pokemon=charmander')
    await expect(page.getByTestId('catch-toggle')).toHaveText('Catch')
  })
})

test.describe('private collection without login', () => {
  test('two visitors see different labels and separate collections, and reloads keep them', async ({ browser }) => {
    const a = await newVisitorPage(browser)
    const b = await newVisitorPage(browser)

    const labelA = await a.page.getByTestId('visitor-label').innerText()
    const labelB = await b.page.getByTestId('visitor-label').innerText()
    expect(labelA).not.toEqual(labelB)

    await open(a.page, 'bulbasaur')
    await a.page.getByTestId('catch-toggle').click()
    await expect(a.page.getByTestId('catch-toggle')).toHaveText('Remove')

    // B never sees A's catch.
    await b.page.goto('/collection')
    await expect(b.page.getByTestId('collection-empty')).toBeVisible()
    await b.page.goto('/?pokemon=bulbasaur')
    await expect(b.page.getByTestId('catch-toggle')).toHaveText('Catch')

    // Each keeps its own state and label across a reload.
    await a.page.goto('/collection')
    await expect(card(a.page, 'bulbasaur')).toBeVisible()
    await a.page.reload()
    await expect(card(a.page, 'bulbasaur')).toBeVisible()
    await expect(a.page.getByTestId('visitor-label')).toHaveText(labelA)

    await b.page.goto('/collection')
    await b.page.reload()
    await expect(b.page.getByTestId('collection-empty')).toBeVisible()
    await expect(b.page.getByTestId('visitor-label')).toHaveText(labelB)

    await a.context.close()
    await b.context.close()
  })

  test('the cookie is httpOnly, so scripts cannot read it', async ({ page, context }) => {
    expect(await page.evaluate(() => document.cookie)).not.toContain('pokeworld_visitor')
    const cookie = (await context.cookies()).find(c => c.name === 'pokeworld_visitor')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
  })
})

import { test as base, expect, type Browser, type Page } from '@playwright/test'
import { fixtureControl } from '../fixtures/server'
import { FIXTURE_URL } from './env'

/** A 1x1 PNG. Pokemon images live on raw.githubusercontent.com, which the suite never reaches. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=', 'base64')
export const IMAGE_HOST = 'https://raw.githubusercontent.com/**'

const stubImages = (page: Page) => page.route(IMAGE_HOST, route => route.fulfill({ contentType: 'image/png', body: PNG }))

export const test = base.extend({
  page: async ({ page }, use) => {
    await stubImages(page)
    await use(page)
  },
})

/** A separate browser, with its own cookies, and so its own visitor. */
export async function newVisitor(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await stubImages(page)
  await page.goto('/')
  const cookies = await context.cookies()
  return { context, page, id: cookies.find(c => c.name === 'pokeworld_visitor')!.value }
}

export { expect }

/** Controls the fixture PokeAPI: request counts, and failures for the next request to a path. */
export const fixture = fixtureControl(FIXTURE_URL)

export const card = (page: Page, name: string) => page.getByTestId(`pokemon-card-${name}`)
export const cards = (page: Page) => page.locator('[data-testid^=pokemon-card-]')
export const openPanel = async (page: Page, name: string) => {
  await card(page, name).locator('a').click()
  await expect(page.getByTestId('panel-name')).toHaveText(new RegExp(name, 'i'))
}

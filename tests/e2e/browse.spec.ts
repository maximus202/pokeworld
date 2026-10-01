import type { Page } from '@playwright/test'
import { card, cards, catchViaApi, expect, test } from './helpers'

const search = (page: Page) => page.getByRole('textbox', { name: 'Search Pokemon by name' })
const pickType = async (page: Page, name: string) => {
  await page.getByRole('combobox', { name: 'Filter by type' }).click()
  await page.getByRole('option', { name }).click()
}
const caughtOnly = (page: Page) => page.getByRole('switch', { name: 'Caught only' })

test('lists the Pokemon a page at a time, with how many are left', async ({ page }) => {
  await page.goto('/')

  await expect(cards(page)).toHaveCount(24)
  await expect(page.getByTestId('load-more')).toHaveText('Load more (6 left)')

  await page.getByTestId('load-more').click()

  await expect(cards(page)).toHaveCount(30)
  await expect(page.getByTestId('load-more')).toBeHidden()
})

test.describe('search', () => {
  test('matches names case-insensitively by substring, and survives a reload', async ({ page }) => {
    await page.goto('/')

    await search(page).fill('BULB')

    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, 'bulbasaur')).toBeVisible()
    await expect(page).toHaveURL(/q=BULB/)

    await page.reload()

    await expect(search(page)).toHaveValue('BULB')
    await expect(cards(page)).toHaveCount(1)
  })

  test('matches the name the way it is shown on the card', async ({ page }) => {
    await page.goto('/')

    await search(page).fill('filler 01') // shown as "Filler 01"; the raw name is "filler-01"

    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, 'filler-01')).toContainText('Filler 01')
  })

  test('says "No matches" with the query, and clearing the filters restores the list', async ({ page }) => {
    await page.goto('/')

    await search(page).fill('zzz')

    await expect(page.getByTestId('no-matches')).toContainText('zzz')

    await page.getByTestId('clear-filters').click()

    await expect(search(page)).toHaveValue('')
    await expect(cards(page)).toHaveCount(24)
    await expect(page).not.toHaveURL(/q=/)
  })

  test('clearing the text restores the list', async ({ page }) => {
    await page.goto('/?q=zzz')
    await expect(page.getByTestId('no-matches')).toBeVisible()

    await search(page).fill('')

    await expect(cards(page)).toHaveCount(24)
  })
})

test.describe('type filter', () => {
  test('includes Pokemon with the type in a second slot, combines with search, and survives a reload', async ({ page }) => {
    await page.goto('/')

    await pickType(page, 'Grass')

    await expect(cards(page)).toHaveCount(6)
    await expect(card(page, 'lotad')).toBeVisible() // water / grass
    await expect(page).toHaveURL(/type=grass/)

    await search(page).fill('lot')
    await expect(cards(page)).toHaveCount(1)

    await page.reload()

    await expect(page.getByRole('combobox', { name: 'Filter by type' })).toHaveText('Grass')
    await expect(cards(page)).toHaveCount(1)
  })

  test('shows no Pokemon of another type', async ({ page }) => {
    await page.goto('/')
    await pickType(page, 'Fire')
    await expect(cards(page)).toHaveCount(3)
    await expect(card(page, 'bulbasaur')).toBeHidden()
  })
})

test.describe('caught only', () => {
  test('lists only what the visitor has caught, together with search and type, and survives a reload', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur', 'lotad', 'charmander')
    await page.reload()

    await caughtOnly(page).click()

    await expect(cards(page)).toHaveCount(3)
    await expect(page).toHaveURL(/caught=true/)

    await pickType(page, 'Grass')
    await expect(cards(page)).toHaveCount(2)
    await search(page).fill('lot')
    await expect(cards(page)).toHaveCount(1)

    await page.reload()

    await expect(caughtOnly(page)).toBeChecked()
    await expect(cards(page)).toHaveCount(1)
  })

  test('says nothing is caught, and offers to show everything, when the visitor has caught nothing', async ({ page }) => {
    await page.goto('/')

    await caughtOnly(page).click()

    await expect(page.getByTestId('caught-empty')).toContainText('You haven\'t caught any Pokemon yet')

    await page.getByTestId('show-all').click()

    await expect(cards(page)).toHaveCount(24)
    await expect(caughtOnly(page)).not.toBeChecked()
  })

  test('marks the Pokemon already caught in the list', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')
    await page.reload()

    await expect(card(page, 'bulbasaur').getByTestId('caught-badge')).toBeVisible()
    await expect(card(page, 'ivysaur').getByTestId('caught-badge')).toBeHidden()
  })
})

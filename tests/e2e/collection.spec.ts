import type { Page } from '@playwright/test'
import { card, cards, catchViaApi, expect, openPanel, test } from './helpers'

const collectionLink = (page: Page) => page.getByTestId('collection-link')

test.describe('catch', () => {
  test('catching in the panel shows the date, flips to Remove, updates the count and appears in My Collection', async ({ page }) => {
    await page.goto('/')
    await expect(collectionLink(page)).toHaveText('My Collection (0)')

    await openPanel(page, 'bulbasaur')
    await page.getByTestId('catch-toggle').click()

    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await expect(page.getByTestId('panel-caught-date')).toBeVisible()
    await expect(collectionLink(page)).toHaveText('My Collection (1)')

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(card(page, 'bulbasaur').getByTestId('caught-badge')).toBeVisible()
    await collectionLink(page).click()

    await expect(page).toHaveURL(/\/collection$/)
    await expect(card(page, 'bulbasaur')).toBeVisible()
    await expect(card(page, 'bulbasaur').getByTestId('caught-date')).toContainText('Caught')
  })

  test('catching twice keeps one entry and the original date', async ({ page }) => {
    await page.goto('/')
    const first = await (await page.request.put('/api/collection/lotad')).json()
    const again = await (await page.request.put('/api/collection/lotad')).json()

    expect(again).toEqual(first)
    await page.goto('/collection')
    await expect(cards(page)).toHaveCount(1)
  })

  test('a failed catch shows a message and changes nothing', async ({ page }) => {
    await page.goto('/')
    await page.route('**/api/collection/bulbasaur', route => route.fulfill({ status: 409, json: { statusMessage: 'Collection is full' } }))

    await openPanel(page, 'bulbasaur')
    await page.getByTestId('catch-toggle').click()

    await expect(page.getByText('Your collection is full')).toBeVisible()
    await expect(page.getByTestId('catch-toggle')).toHaveText('Catch')
    await expect(collectionLink(page)).toHaveText('My Collection (0)')
  })
})

test.describe('My Collection', () => {
  test('lists the most recent catch first, each with the date it was caught', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')
    await page.waitForTimeout(20) // the catch time has millisecond precision
    await catchViaApi(page, 'lotad')

    await page.goto('/collection')

    await expect(cards(page)).toHaveCount(2)
    await expect(cards(page).first()).toHaveAttribute('data-testid', 'pokemon-card-lotad')
    await expect(page.getByTestId('caught-date')).toHaveCount(2)
  })

  test('shows a prompt to browse when it is empty', async ({ page }) => {
    await page.goto('/collection')

    await expect(page.getByTestId('collection-empty')).toContainText('You haven\'t caught any Pokemon yet')

    await page.getByRole('link', { name: 'Browse Pokemon' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(cards(page).first()).toBeVisible()
  })

  test('the caught date is shown in the visitor\'s own time zone', async ({ browser }) => {
    // Pick a zone whose calendar day is not the UTC day right now (one of these two always is), so
    // showing the UTC date instead would fail.
    const day = (timeZone: string) => new Date().toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })
    const timezoneId = ['Pacific/Kiritimati', 'Pacific/Pago_Pago'].find(zone => day(zone) !== day('UTC'))!
    const context = await browser.newContext({ timezoneId })
    const page = await context.newPage()
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')

    await page.goto('/collection')

    await expect(card(page, 'bulbasaur').getByTestId('caught-date')).toHaveText(`Caught ${day(timezoneId)}`)
    await context.close()
  })
})

test.describe('remove', () => {
  test('removing in the panel flips the button back to Catch', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')
    await page.reload()

    await openPanel(page, 'bulbasaur')
    await expect(page.getByTestId('catch-toggle')).toHaveText('Remove')
    await page.getByTestId('catch-toggle').click()

    await expect(page.getByTestId('catch-toggle')).toHaveText('Catch')
    await expect(collectionLink(page)).toHaveText('My Collection (0)')
  })

  test('removing straight from the grid works without opening the panel', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur', 'lotad')
    await page.goto('/collection')

    await page.getByRole('button', { name: 'Remove Bulbasaur' }).click()

    await expect(cards(page)).toHaveCount(1)
    await expect(card(page, 'bulbasaur')).toBeHidden()
    await expect(collectionLink(page)).toHaveText('My Collection (1)')
    await expect(page).not.toHaveURL(/pokemon=/)
  })
})

test.describe('reset', () => {
  test('cancelling changes nothing', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')
    await page.reload()

    await page.getByTestId('reset-button').click()
    await page.getByTestId('reset-cancel').click()

    await expect(page.getByTestId('reset-confirm')).toBeHidden()
    await expect(collectionLink(page)).toHaveText('My Collection (1)')
  })

  test('confirming empties the collection, closes the dialog, and the panel offers Catch again', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur', 'lotad')
    await page.reload()

    await page.getByTestId('reset-button').click()
    await page.getByTestId('reset-confirm').click()

    await expect(page.getByTestId('reset-confirm')).toBeHidden()
    await expect(collectionLink(page)).toHaveText('My Collection (0)')

    await openPanel(page, 'bulbasaur')
    await expect(page.getByTestId('catch-toggle')).toHaveText('Catch')
  })

  test('a failed reset shows an error in the dialog and keeps the collection', async ({ page }) => {
    await page.goto('/')
    await catchViaApi(page, 'bulbasaur')
    await page.reload()
    await page.route('**/api/collection', route => (route.request().method() === 'DELETE' ? route.fulfill({ status: 500, json: {} }) : route.fallback()))

    await page.getByTestId('reset-button').click()
    await page.getByTestId('reset-confirm').click()

    await expect(page.getByTestId('reset-error')).toContainText('Nothing was changed')
    await expect(collectionLink(page)).toHaveText('My Collection (1)')
    await page.getByTestId('reset-cancel').click()
    await expect(page.getByTestId('reset-error')).toBeHidden()
  })
})

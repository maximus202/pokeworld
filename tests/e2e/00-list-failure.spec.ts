import { expect, fixture, test } from './helpers'

// Runs first: it needs the app not to have loaded the Pokemon index yet, because a loaded index is
// cached for the life of the process.
test('an upstream failure shows an error with Try again, and Try again recovers', async ({ page }) => {
  await fixture.failAll() // every request fails: the browser's $fetch retries a failed GET once on its own

  await page.goto('/')
  await expect(page.getByTestId('list-error')).toBeVisible()

  await fixture.failAll(false)
  await page.getByTestId('list-retry').click()

  await expect(page.getByTestId('pokemon-list')).toBeVisible()
  await expect(page.getByTestId('list-error')).toBeHidden()
})

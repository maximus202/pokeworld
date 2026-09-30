import { cards, expect, test } from './helpers'

test('lists the Pokemon a page at a time, with how many are left', async ({ page }) => {
  await page.goto('/')

  await expect(cards(page)).toHaveCount(24)
  await expect(page.getByTestId('load-more')).toHaveText('Load more (6 left)')

  await page.getByTestId('load-more').click()

  await expect(cards(page)).toHaveCount(30)
  await expect(page.getByTestId('load-more')).toBeHidden()
})

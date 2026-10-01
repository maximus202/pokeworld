import { card, expect, openPanel, test } from './helpers'

test.describe('details panel', () => {
  test('shows the required fields', async ({ page }) => {
    await page.goto('/')

    await openPanel(page, 'bulbasaur')

    await expect(page.getByTestId('panel-name')).toHaveText('Bulbasaur')
    await expect(page.getByRole('dialog')).toContainText('#0001') // its Pokedex number
    await expect(page.getByTestId('panel-height')).toHaveText('0.7 m (2′04″)')
    await expect(page.getByTestId('panel-types')).toContainText('Grass')
    await expect(page.getByTestId('panel-types')).toContainText('Poison')
    await expect(page.getByTestId('panel-abilities')).toContainText('Overgrow')
    await expect(page.getByRole('dialog').getByRole('img', { name: 'Bulbasaur' })).toBeVisible()
    await expect(page).toHaveURL(/pokemon=bulbasaur/)
  })

  test('closing it returns to the same screen with its search and filters', async ({ page }) => {
    await page.goto('/?q=bulb&type=grass')
    await openPanel(page, 'bulbasaur')

    await page.getByRole('button', { name: 'Close' }).click()

    await expect(page.getByTestId('panel-name')).toBeHidden()
    await expect(page).toHaveURL(/q=bulb/)
    await expect(page).toHaveURL(/type=grass/)
    await expect(page).not.toHaveURL(/pokemon=/)
    await expect(card(page, 'bulbasaur')).toBeVisible()
  })

  test('a shared link opens the same panel, on either screen', async ({ page }) => {
    await page.goto('/?pokemon=lotad')
    await expect(page.getByTestId('panel-name')).toHaveText('Lotad')

    await page.reload()
    await expect(page.getByTestId('panel-name')).toHaveText('Lotad')

    await page.goto('/collection?pokemon=charmander')
    await expect(page.getByTestId('panel-name')).toHaveText('Charmander')
  })

  test('opening a Pokemon keeps the pages already loaded with Load more', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('load-more').click()
    await expect(page.locator('[data-testid^=pokemon-card-]')).toHaveCount(30)

    await openPanel(page, 'lotad')

    await expect(page.locator('[data-testid^=pokemon-card-]')).toHaveCount(30)
  })
})

test.describe('Grass shows shiny', () => {
  test('a Grass type shows the shiny image and badge in the list and in the panel, whichever slot the type is in', async ({ page }) => {
    await page.goto('/')

    for (const name of ['bulbasaur', 'lotad']) { // grass first, grass second
      await expect(card(page, name).getByTestId('shiny-badge')).toBeVisible()
      await expect(card(page, name).locator('img')).toHaveAttribute('src', /\/official-artwork\/shiny\//)
    }

    await openPanel(page, 'lotad')

    await expect(page.getByRole('dialog').getByTestId('shiny-badge')).toBeVisible()
    await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /\/shiny\/270\.png/)
  })

  test('a non-Grass type shows the default image with no badge', async ({ page }) => {
    await page.goto('/')

    await expect(card(page, 'charmander').getByTestId('shiny-badge')).toBeHidden()
    await expect(card(page, 'charmander').locator('img')).toHaveAttribute('src', /\/official-artwork\/4\.png/)

    await openPanel(page, 'charmander')

    await expect(page.getByRole('dialog').getByTestId('shiny-badge')).toBeHidden()
  })

  test('when the shiny image fails to load, the default image is shown without the badge', async ({ page }) => {
    await page.route('**/official-artwork/shiny/1.png', route => route.abort())
    await page.goto('/')

    await expect(card(page, 'bulbasaur').locator('img')).toHaveAttribute('src', /\/official-artwork\/1\.png$/)
    await expect(card(page, 'bulbasaur').getByTestId('shiny-badge')).toBeHidden()
    await expect(card(page, 'ivysaur').getByTestId('shiny-badge')).toBeVisible() // only the failing one changed
  })

  test('a Pokemon with no official artwork falls back to its plain sprite', async ({ page }) => {
    await page.goto('/?pokemon=spriteonly')

    await expect(page.getByTestId('panel-name')).toHaveText('Spriteonly')
    await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', 'https://example.test/spriteonly.png')
  })
})

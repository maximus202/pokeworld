import { cards, catchViaApi, expect, newVisitor, test } from './helpers'

const label = (id: string) => `Trainer #${id.slice(0, 4)}`

test.describe('a private collection without signing up', () => {
  test('two browsers are two visitors, each with their own label', async ({ browser }) => {
    const [a, b] = [await newVisitor(browser), await newVisitor(browser)]

    expect(a.id).not.toBe(b.id)
    await expect(a.page.getByTestId('visitor-label')).toHaveText(label(a.id))
    await expect(b.page.getByTestId('visitor-label')).toHaveText(label(b.id))
    await expect(a.page.getByTestId('visitor-label')).not.toHaveText(await b.page.getByTestId('visitor-label').innerText())

    await Promise.all([a.context.close(), b.context.close()])
  })

  test('a catch in one browser never appears in the other', async ({ browser }) => {
    const [a, b] = [await newVisitor(browser), await newVisitor(browser)]

    await catchViaApi(a.page, 'bulbasaur')
    await a.page.goto('/collection')
    await b.page.goto('/collection')

    await expect(cards(a.page)).toHaveCount(1)
    await expect(b.page.getByTestId('collection-empty')).toBeVisible()
    await expect(b.page.getByTestId('collection-link')).toHaveText('My Collection (0)')

    await b.page.goto('/?caught=true')
    await expect(b.page.getByTestId('caught-empty')).toBeVisible()

    await Promise.all([a.context.close(), b.context.close()])
  })

  test('one browser removing or resetting never changes the other\'s collection', async ({ browser }) => {
    const [a, b] = [await newVisitor(browser), await newVisitor(browser)]
    for (const v of [a, b]) await catchViaApi(v.page, 'bulbasaur', 'lotad')

    await b.page.request.delete('/api/collection/bulbasaur')
    await b.page.request.delete('/api/collection')
    await a.page.goto('/collection')

    await expect(cards(a.page)).toHaveCount(2)
    await b.page.goto('/collection')
    await expect(b.page.getByTestId('collection-empty')).toBeVisible()

    await Promise.all([a.context.close(), b.context.close()])
  })

  test('reloading keeps a browser\'s own collection, and its label matches the one the server rendered', async ({ browser }) => {
    const v = await newVisitor(browser)
    await catchViaApi(v.page, 'lotad')

    const response = await v.page.goto('/collection')
    const html = await response!.text() // what the server rendered, before any script ran

    expect(html).toContain(label(v.id))
    expect(html).toMatch(/My Collection \(1\)/) // the count is right on first paint, with no flash of 0
    await expect(v.page.getByTestId('visitor-label')).toHaveText(label(v.id))
    await v.page.reload()
    await expect(cards(v.page)).toHaveCount(1)
    await expect(v.page.getByTestId('visitor-label')).toHaveText(label(v.id))

    await v.context.close()
  })

  test('a first visit renders the label of the cookie it is given', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    const response = await page.goto('/')
    const html = await response!.text()
    const id = (await context.cookies()).find(c => c.name === 'pokeworld_visitor')!.value

    expect(html).toContain(label(id))
    expect(html).toMatch(/My Collection \(0\)/)
    await context.close()
  })
})

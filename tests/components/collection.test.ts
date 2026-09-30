import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { CollectionItem } from '#shared/types/pokemon'
import CollectionPage from '~/pages/collection.vue'

const caught = (name: string, caughtAt: string, loaded = true): CollectionItem => ({
  name,
  caughtAt,
  pokemon: loaded ? { id: 1, name, shiny: false, imageUrl: `https://img.test/${name}.png` } : null,
})

// The fake server: the collection it holds, an optional gate to hold its response, and the removals it saw.
let server: CollectionItem[] = []
let gate: Promise<void> | undefined
let removed: string[] = []
registerEndpoint('/api/collection', async () => {
  await gate
  return { count: server.length, items: server }
})
for (const name of ['bulbasaur', 'lotad', 'charmander']) {
  registerEndpoint(`/api/collection/${name}`, {
    method: 'DELETE',
    handler: () => {
      removed.push(name)
      server = server.filter(item => item.name !== name)
      return null
    },
  })
}

const mounted: { unmount(): void }[] = []
afterEach(() => mounted.splice(0).forEach(wrapper => wrapper.unmount()))
beforeEach(() => {
  server = []
  gate = undefined
  removed = []
  useState('collection-items').value = []
})

async function mountScreen() {
  const wrapper = await mountSuspended(CollectionPage, { route: '/collection' })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
type Screen = Awaited<ReturnType<typeof mountScreen>>
const cardNames = (screen: Screen) => screen.findAll('[data-testid^=pokemon-card-]').map(card => card.attributes('data-testid')!.replace('pokemon-card-', ''))

describe('collection screen', () => {
  it('lists the most recent catch first, each with the date it was caught', async () => {
    server = [caught('charmander', '2026-09-28T16:00:00.000Z'), caught('bulbasaur', '2026-09-27T16:00:00.000Z')]
    const screen = await mountScreen()

    expect(cardNames(screen)).toEqual(['charmander', 'bulbasaur'])
    const dates = screen.findAll('[data-testid=caught-date]').map(date => date.text())
    expect(dates).toEqual([expect.stringMatching(/^Caught Sep (28|29), 2026$/), expect.stringMatching(/^Caught Sep (27|28), 2026$/)])
  })

  it('shows a prompt to browse Pokemon when the collection is empty', async () => {
    const screen = await mountScreen()
    expect(screen.find('[data-testid=collection-empty]').text()).toContain('You haven\'t caught any Pokemon yet')
    expect(screen.find('[data-testid=collection-empty] a').attributes('href')).toBe('/')
  })

  it('shows a skeleton while the collection loads, then the prompt', async () => {
    let release!: () => void
    gate = new Promise(resolve => (release = resolve))
    const opening = mountSuspended(CollectionPage, { route: '/collection' })
    const screen = await opening
    mounted.push(screen)
    await vi.waitFor(() => expect(screen.find('[data-testid=collection-loading]').exists()).toBe(true))

    release()
    await vi.waitFor(() => expect(screen.find('[data-testid=collection-empty]').exists()).toBe(true))
    expect(screen.find('[data-testid=collection-loading]').exists()).toBe(false)
  })

  it('keeps showing the Pokemon already loaded, not a skeleton, while it re-reads the collection', async () => {
    server = [caught('bulbasaur', '2026-09-27T16:00:00.000Z')]
    useState('collection-items').value = server
    let release!: () => void
    gate = new Promise(resolve => (release = resolve))

    const screen = await mountSuspended(CollectionPage, { route: '/collection' })
    mounted.push(screen)

    expect(cardNames(screen)).toEqual(['bulbasaur'])
    expect(screen.find('[data-testid=collection-loading]').exists()).toBe(false)
    release()
    await flushPromises()
  })

  it('removes a Pokemon straight from the grid, without opening the panel', async () => {
    server = [caught('charmander', '2026-09-28T16:00:00.000Z'), caught('bulbasaur', '2026-09-27T16:00:00.000Z')]
    const screen = await mountScreen()
    const button = screen.find('[data-testid=pokemon-card-bulbasaur] [data-testid=remove-button]')
    expect(button.attributes('aria-label')).toBe('Remove Bulbasaur')

    await button.trigger('click')

    await vi.waitFor(() => expect(cardNames(screen)).toEqual(['charmander']))
    expect(removed).toEqual(['bulbasaur'])
    expect(useRoute().query.pokemon).toBeUndefined()
  })

  it('opens the details panel from a card and stays on the collection screen', async () => {
    server = [caught('bulbasaur', '2026-09-27T16:00:00.000Z')]
    const screen = await mountScreen()
    expect(screen.find('[data-testid=pokemon-card-bulbasaur] a').attributes('href')).toBe('/collection?pokemon=bulbasaur')
  })
})

describe('a Pokemon that could not be loaded', () => {

  it('keeps its place, still counts, and can be removed', async () => {
    server = [caught('bulbasaur', '2026-09-28T16:00:00.000Z'), caught('lotad', '2026-09-27T16:00:00.000Z', false)]
    const screen = await mountScreen()

    const card = screen.find('[data-testid=collection-error-lotad]')
    expect(card.text()).toContain('Lotad')
    expect(card.text()).toContain('Couldn\'t load this Pokemon')
    expect(card.text()).toMatch(/Caught Sep (27|28), 2026/)
    expect(useCollection().count.value).toBe(2)
    expect(cardNames(screen)).toEqual(['bulbasaur'])

    await card.find('[data-testid=remove-button]').trigger('click')

    await vi.waitFor(() => expect(screen.find('[data-testid=collection-error-lotad]').exists()).toBe(false))
    expect(removed).toEqual(['lotad'])
  })

  it('turns into a normal card when "Try again" succeeds', async () => {
    server = [caught('lotad', '2026-09-27T16:00:00.000Z', false)]
    const screen = await mountScreen()
    expect(screen.find('[data-testid=collection-error-lotad]').exists()).toBe(true)

    server = [caught('lotad', '2026-09-27T16:00:00.000Z', true)]
    await screen.find('[data-testid=retry-button]').trigger('click')

    await vi.waitFor(() => expect(cardNames(screen)).toEqual(['lotad']))
    expect(screen.find('[data-testid=collection-error-lotad]').exists()).toBe(false)
  })

  it('stays as an error card, and keeps counting, when "Try again" fails again', async () => {
    server = [caught('lotad', '2026-09-27T16:00:00.000Z', false)]
    const screen = await mountScreen()

    await screen.find('[data-testid=retry-button]').trigger('click')
    await flushPromises()

    expect(screen.find('[data-testid=collection-error-lotad]').exists()).toBe(true)
    expect(useCollection().count.value).toBe(1)
  })
})

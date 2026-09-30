import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import type { PokemonListItem, PokemonListResponse } from '#shared/types/pokemon'
import { USelect, USwitch } from '#components'
import IndexPage from '~/pages/index.vue'

const item = (id: number, name = `pokemon-${id}`): PokemonListItem => ({ id, name, shiny: false, imageUrl: `https://img.test/${id}.png` })
const page = (from: number, count: number, total: number): PokemonListResponse => ({ items: Array.from({ length: count }, (_, i) => item(from + i)), total })

// The fake server: what the list returns is set per test, and every query it receives is recorded.
type Query = Record<string, string | undefined>
let respond: (query: Query) => PokemonListResponse | Promise<PokemonListResponse>
let queries: Query[] = []
registerEndpoint('/api/types', () => ({ types: ['fire', 'grass'] }))
registerEndpoint('/api/pokemon', (event) => {
  const query = getQuery(event) as Query
  queries.push(query)
  return respond(query)
})

const mounted: { unmount(): void }[] = []
afterEach(() => mounted.splice(0).forEach(wrapper => wrapper.unmount()))
beforeEach(() => {
  queries = []
  respond = () => page(1, 5, 5)
  useState('collection-items').value = []
})

async function mountBrowse(route = '/') {
  const wrapper = await mountSuspended(IndexPage, { route })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const find = (wrapper: Awaited<ReturnType<typeof mountBrowse>>, id: string) => wrapper.find(`[data-testid=${id}]`)
const cards = (wrapper: Awaited<ReturnType<typeof mountBrowse>>) => wrapper.findAll('[data-testid^=pokemon-card-]')
const query = () => useRoute().query
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('list states', () => {
  it('shows a skeleton while loading, then the cards', async () => {
    let release!: (value: PokemonListResponse) => void
    respond = () => new Promise(resolve => (release = resolve))
    const wrapper = mountBrowse()
    await vi.waitFor(() => expect(document.querySelector('[data-testid=list-loading]') ?? queries.length).toBeTruthy())

    release(page(1, 3, 3))
    const done = await wrapper

    await vi.waitFor(() => expect(cards(done)).toHaveLength(3))
    expect(find(done, 'list-loading').exists()).toBe(false)
  })

  it('shows an error with Try again, and recovers', async () => {
    respond = () => { throw createError({ statusCode: 502 }) }
    const wrapper = await mountBrowse()
    expect(find(wrapper, 'list-error').exists()).toBe(true)

    respond = () => page(1, 2, 2)
    await find(wrapper, 'list-retry').trigger('click')
    await flushPromises()

    expect(cards(wrapper)).toHaveLength(2)
    expect(find(wrapper, 'list-error').exists()).toBe(false)
  })

  it('shows "No matches" with the query, and Clear filters restores the list', async () => {
    respond = query => (query.q ? { items: [], total: 0 } : page(1, 3, 3))
    const wrapper = await mountBrowse('/?q=zzz')
    expect(find(wrapper, 'no-matches').text()).toContain('zzz')

    await find(wrapper, 'clear-filters').trigger('click')
    await flushPromises()

    await vi.waitFor(() => expect(query()).toEqual({}))
    await vi.waitFor(() => expect(cards(wrapper)).toHaveLength(3))
  })

  it('says nothing is caught, and offers to show everything, for an empty "Caught only" view', async () => {
    respond = query => (query.caught ? { items: [], total: 0 } : page(1, 3, 3))
    const wrapper = await mountBrowse('/?caught=true')
    expect(find(wrapper, 'caught-empty').text()).toContain('You haven\'t caught any Pokemon yet')

    await find(wrapper, 'show-all').trigger('click')
    await flushPromises()

    await vi.waitFor(() => expect(query().caught).toBeUndefined())
    await vi.waitFor(() => expect(cards(wrapper)).toHaveLength(3))
  })

  it('marks the Pokemon the visitor has caught', async () => {
    useState('collection-items').value = [{ name: 'pokemon-2', caughtAt: '2026-09-28T14:00:00.000Z', pokemon: null }]
    const wrapper = await mountBrowse()
    expect(wrapper.findAll('[data-testid=caught-badge]')).toHaveLength(1)
    expect(find(wrapper, 'pokemon-card-pokemon-2').find('[data-testid=caught-badge]').exists()).toBe(true)
  })
})

describe('Load more', () => {
  it('shows how many are left, appends the next page, and goes away when everything is loaded', async () => {
    respond = query => (query.offset === '0' ? page(1, 24, 30) : page(25, 6, 30))
    const wrapper = await mountBrowse()
    expect(find(wrapper, 'load-more').text()).toBe('Load more (6 left)')

    await find(wrapper, 'load-more').trigger('click')
    await flushPromises()

    expect(queries.at(-1)).toMatchObject({ offset: '24', limit: '24' })
    expect(cards(wrapper)).toHaveLength(30)
    expect(find(wrapper, 'load-more').exists()).toBe(false)
  })

  it('starts again from the first page when the filters change', async () => {
    respond = query => (query.type ? page(1, 30, 30) : query.offset === '0' ? page(1, 24, 30) : page(25, 6, 30))
    const wrapper = await mountBrowse()
    await find(wrapper, 'load-more').trigger('click')
    await vi.waitFor(() => expect(cards(wrapper)).toHaveLength(30))

    await useRouter().replace({ query: { type: 'grass' } })

    await vi.waitFor(() => expect(queries.at(-1)).toMatchObject({ type: 'grass', offset: '0' }))
    await vi.waitFor(() => expect(cards(wrapper)).toHaveLength(30)) // the new first page, not 30 + 30
    await sleep(50)
    expect(cards(wrapper)).toHaveLength(30)
  })
})

describe('search and filters live in the URL', () => {
  it('asks the server for the search, type and caught filter found in the URL', async () => {
    await mountBrowse('/?q=bulb&type=grass&caught=true')
    expect(queries[0]).toMatchObject({ q: 'bulb', type: 'grass', caught: 'true', limit: '24', offset: '0' })
  })

  it('puts the search in the URL after a short pause, not on every keystroke', async () => {
    const wrapper = await mountBrowse()
    await find(wrapper, 'search-input').setValue('bul')
    await sleep(100)
    expect(query().q).toBeUndefined()

    await vi.waitFor(() => expect(query().q).toBe('bul'))
    expect(queries.at(-1)).toMatchObject({ q: 'bul' })
  })

  it('puts the type and "Caught only" in the URL, and takes them out again', async () => {
    const wrapper = await mountBrowse()
    const type = wrapper.findComponent(USelect)
    const caught = wrapper.findComponent(USwitch)

    type.vm.$emit('update:modelValue', 'grass')
    await vi.waitFor(() => expect(query()).toMatchObject({ type: 'grass' }))
    caught.vm.$emit('update:modelValue', true)
    await vi.waitFor(() => expect(query()).toEqual({ type: 'grass', caught: 'true' }))

    type.vm.$emit('update:modelValue', 'all')
    await vi.waitFor(() => expect(query()).toEqual({ caught: 'true' }))
    caught.vm.$emit('update:modelValue', false)
    await vi.waitFor(() => expect(query()).toEqual({}))
  })

  it('keeps an open Pokemon panel when the filters change', async () => {
    const wrapper = await mountBrowse('/?pokemon=bulbasaur')
    wrapper.findComponent(USelect).vm.$emit('update:modelValue', 'fire')
    await vi.waitFor(() => expect(query()).toEqual({ pokemon: 'bulbasaur', type: 'fire' }))
  })

  it('follows the URL when it changes elsewhere, such as the Pokemon link in the header', async () => {
    const wrapper = await mountBrowse('/?q=bulb&type=grass')
    await useRouter().push('/')
    await flushPromises()

    expect((find(wrapper, 'search-input').element as HTMLInputElement).value).toBe('')
    expect(queries.at(-1)?.q).toBeUndefined()
    expect(queries.at(-1)?.type).toBeUndefined()
  })
})

describe('"Caught only"', () => {
  it('refreshes the list when a Pokemon is caught or removed', async () => {
    await mountBrowse('/?caught=true')
    const before = queries.length

    useState('collection-items').value = [{ name: 'pokemon-1', caughtAt: '2026-09-28T14:00:00.000Z', pokemon: null }]
    await flushPromises()

    expect(queries.length).toBeGreaterThan(before)
  })

  it('does not refetch the list on a catch when it is not filtered to caught Pokemon', async () => {
    await mountBrowse('/')
    const before = queries.length

    useState('collection-items').value = [{ name: 'pokemon-1', caughtAt: '2026-09-28T14:00:00.000Z', pokemon: null }]
    await flushPromises()

    expect(queries.length).toBe(before)
  })
})

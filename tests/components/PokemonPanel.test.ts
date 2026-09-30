import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { PokemonDetails } from '#shared/types/pokemon'
import PokemonPanel from '~/components/PokemonPanel.vue'

const details = (name: string, over: Partial<PokemonDetails> = {}): PokemonDetails => ({
  id: 1, name, height: 7, abilities: ['overgrow', 'chlorophyll'], types: ['grass', 'poison'],
  image: { url: 'https://img.test/shiny/1.png', shiny: true }, ...over,
})

// A fake server whose responses the test releases by hand, to control ordering.
const pending = new Map<string, { resolve: (d: PokemonDetails) => void, reject: () => void }>()
const hold = (name: string) => new Promise<PokemonDetails>((resolve, reject) => pending.set(name, { resolve, reject: () => reject(createError({ statusCode: 500 })) }))
let mode: Record<string, 'ok' | 'fail' | 'hold'> = {}
let caught: Record<string, string> = {}
let changes: string[] = []

for (const name of ['bulbasaur', 'lotad', 'slow', 'fast']) {
  registerEndpoint(`/api/pokemon/${name}`, () => {
    if (mode[name] === 'fail') throw createError({ statusCode: 502 })
    return mode[name] === 'hold' ? hold(name) : details(name, { id: name === 'lotad' ? 270 : 1 })
  })
}
registerEndpoint('/api/collection', () => ({ count: 0, items: Object.entries(caught).map(([name, caughtAt]) => ({ name, caughtAt, pokemon: null })) }))
registerEndpoint('/api/collection/bulbasaur', {
  method: 'PUT',
  handler: () => { changes.push('catch'); caught.bulbasaur = '2026-09-28T14:00:00.000Z'; return null },
})
registerEndpoint('/api/collection/bulbasaur', {
  method: 'DELETE',
  handler: () => { changes.push('remove'); delete caught.bulbasaur; return null },
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const body = () => document.body
const text = (testId: string) => body().querySelector(`[data-testid=${testId}]`)?.textContent?.trim()
const click = async (testId: string) => {
  body().querySelector<HTMLElement>(`[data-testid=${testId}]`)!.click()
  await flushPromises()
}

const mounted: { unmount(): void }[] = []
afterEach(() => mounted.splice(0).forEach(wrapper => wrapper.unmount()))

beforeEach(() => {
  pending.clear()
  mode = {}
  caught = {}
  changes = []
  useState('collection-items').value = []
})

async function openPanel(name = 'bulbasaur') {
  const wrapper = await mountSuspended(PokemonPanel, { route: `/?q=bulb&pokemon=${name}` })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('PokemonPanel', () => {
  it('shows the required fields once the details load', async () => {
    await openPanel()
    await vi.waitFor(() => expect(text('panel-name')).toBe('Bulbasaur'))
    expect(text('panel-height')).toBe('0.7 m (2′04″)')
    expect(text('panel-types')).toContain('Grass')
    expect(text('panel-types')).toContain('Poison')
    expect(text('panel-abilities')).toContain('Overgrow')
    expect(body().querySelector('img')!.getAttribute('src')).toContain('/shiny/1.png')
    expect(text('shiny-badge')).toContain('Shiny')
  })

  it('shows a skeleton while loading', async () => {
    mode.bulbasaur = 'hold'
    await openPanel()
    expect(body().querySelector('[data-testid=panel-loading]')).toBeTruthy()
    pending.get('bulbasaur')!.resolve(details('bulbasaur'))
    await vi.waitFor(() => expect(text('panel-name')).toBe('Bulbasaur'))
  })

  it('shows an error with Try again, and recovers', async () => {
    mode.bulbasaur = 'fail'
    await openPanel()
    await vi.waitFor(() => expect(body().querySelector('[data-testid=panel-error]')).toBeTruthy())

    mode.bulbasaur = 'ok'
    await click('panel-retry')

    await vi.waitFor(() => expect(text('panel-name')).toBe('Bulbasaur'))
    expect(body().querySelector('[data-testid=panel-error]')).toBeNull()
  })

  it('offers Catch, and after catching shows the caught date and Remove', async () => {
    await openPanel()
    await vi.waitFor(() => expect(text('catch-toggle')).toBe('Catch'))
    expect(body().querySelector('[data-testid=panel-caught-date]')).toBeNull()

    await click('catch-toggle')

    await vi.waitFor(() => expect(text('catch-toggle')).toBe('Remove'))
    expect(changes).toEqual(['catch'])
    expect(text('panel-caught-date')).toMatch(/Sep (28|29), 2026/)
  })

  it('removes a caught Pokemon and goes back to Catch', async () => {
    caught = { bulbasaur: '2026-09-28T14:00:00.000Z' }
    await useCollection().refresh()
    await openPanel()
    await vi.waitFor(() => expect(text('catch-toggle')).toBe('Remove'))

    await click('catch-toggle')

    await vi.waitFor(() => expect(text('catch-toggle')).toBe('Catch'))
    expect(changes).toEqual(['remove'])
    expect(body().querySelector('[data-testid=panel-caught-date]')).toBeNull()
  })

  it('ignores a slow response for a Pokemon the visitor has already moved on from', async () => {
    mode.slow = 'hold'
    mode.fast = 'hold'
    await openPanel('slow')
    await useRouter().replace({ query: { pokemon: 'fast' } })
    await vi.waitFor(() => expect(pending.has('fast')).toBe(true))

    pending.get('fast')!.resolve(details('fast'))
    await vi.waitFor(() => expect(text('panel-name')).toBe('Fast'))
    pending.get('slow')!.resolve(details('slow'))
    await sleep(100) // long enough for the slow response to have arrived and been (wrongly) applied

    expect(text('panel-name')).toBe('Fast')
  })

  it('closes by removing only the pokemon parameter, keeping the rest of the screen', async () => {
    await openPanel()
    await vi.waitFor(() => expect(text('panel-name')).toBe('Bulbasaur'))

    await usePokemonPanel().close()

    expect(useRoute().query).toEqual({ q: 'bulb' })
  })
})

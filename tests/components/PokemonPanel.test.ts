import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PokemonPanel from '../../app/components/PokemonPanel.vue'

const bulbasaur = {
  id: 1,
  name: 'bulbasaur',
  height: 7,
  abilities: ['overgrow', 'chlorophyll'],
  types: ['grass', 'poison'],
  image: { url: 'https://img.test/official-artwork/shiny/1.png', shiny: true }
}
const charmander = {
  id: 4,
  name: 'charmander',
  height: 6,
  abilities: ['blaze'],
  types: ['fire'],
  image: { url: 'https://img.test/official-artwork/4.png', shiny: false }
}

// What the mocked server currently holds for the caller.
let caught: { name: string, caughtAt: string }[] = []
let detailsStatus: Record<string, number> = {}
const calls: string[] = []

function collectionResponse() {
  return {
    count: caught.length,
    items: caught.map(c => ({ ...c, pokemon: { id: 1, name: c.name, imageUrl: '', shiny: false } }))
  }
}

registerEndpoint('/api/collection', () => collectionResponse())
for (const [name, body] of Object.entries({ bulbasaur, charmander })) {
  registerEndpoint(`/api/pokemon/${name}`, () => {
    if (detailsStatus[name]) throw createError({ statusCode: detailsStatus[name], statusMessage: 'mocked failure' })
    return body
  })
  registerEndpoint(`/api/collection/${name}`, {
    method: 'PUT',
    handler: () => {
      calls.push(`PUT ${name}`)
      caught = [...caught, { name, caughtAt: '2026-09-28T14:03:11.402Z' }]
      return { name, caughtAt: '2026-09-28T14:03:11.402Z' }
    }
  })
  registerEndpoint(`/api/collection/${name}`, {
    method: 'DELETE',
    handler: () => {
      calls.push(`DELETE ${name}`)
      caught = caught.filter(c => c.name !== name)
      return null
    }
  })
}

const text = () => document.body.textContent ?? ''
const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

async function openPanel(name: string) {
  const wrapper = await mountSuspended(PokemonPanel, { attachTo: document.body })
  await navigateTo(`/?pokemon=${name}`)
  await flushPromises()
  await new Promise(r => setTimeout(r, 30))
  await flushPromises()
  return wrapper
}

describe('PokemonPanel', () => {
  let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

  beforeEach(async () => {
    caught = []
    detailsStatus = {}
    calls.length = 0
    await navigateTo('/')
    const state = useState<unknown[]>('collection-items')
    state.value = []
  })

  afterEach(async () => {
    wrapper?.unmount()
    wrapper = undefined
    await navigateTo('/')
    await flushPromises()
  })

  it('shows the required details: name, height, abilities and image', async () => {
    wrapper = await openPanel('bulbasaur')
    expect(byTestId('panel-name')?.textContent).toBe('Bulbasaur')
    expect(byTestId('panel-height')?.textContent).toBe('0.7 m (2′04″)')
    expect(byTestId('panel-abilities')?.textContent).toContain('Overgrow')
    expect(byTestId('panel-abilities')?.textContent).toContain('Chlorophyll')
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe(bulbasaur.image.url)
  })

  it('shows the Shiny badge for a grass Pokemon and not for others', async () => {
    wrapper = await openPanel('bulbasaur')
    expect(byTestId('shiny-badge')).not.toBeNull()
    wrapper.unmount()

    wrapper = await openPanel('charmander')
    expect(byTestId('panel-name')?.textContent).toBe('Charmander')
    expect(byTestId('shiny-badge')).toBeNull()
  })

  it('offers Catch, then shows the caught date and Remove once caught', async () => {
    wrapper = await openPanel('bulbasaur')
    expect(byTestId('catch-toggle')?.textContent).toContain('Catch')
    expect(byTestId('panel-caught-date')).toBeNull()

    byTestId('catch-toggle')!.click()
    await flushPromises()
    await new Promise(r => setTimeout(r, 30))
    await flushPromises()

    expect(calls).toEqual(['PUT bulbasaur'])
    expect(byTestId('catch-toggle')?.textContent).toContain('Remove')
    expect(byTestId('panel-caught-date')?.textContent).toBe(
      new Date('2026-09-28T14:03:11.402Z').toLocaleDateString('en-US', { dateStyle: 'medium' })
    )
  })

  it('flips back to Catch after Remove', async () => {
    caught = [{ name: 'bulbasaur', caughtAt: '2026-09-28T14:03:11.402Z' }]
    useState<unknown[]>('collection-items').value = collectionResponse().items
    wrapper = await openPanel('bulbasaur')
    expect(byTestId('catch-toggle')?.textContent).toContain('Remove')

    byTestId('catch-toggle')!.click()
    await flushPromises()
    await new Promise(r => setTimeout(r, 30))
    await flushPromises()

    expect(calls).toEqual(['DELETE bulbasaur'])
    expect(byTestId('catch-toggle')?.textContent).toContain('Catch')
    expect(byTestId('panel-caught-date')).toBeNull()
  })

  it('shows an error with Try again when the details fail, and recovers on retry', async () => {
    detailsStatus = { bulbasaur: 502 }
    wrapper = await openPanel('bulbasaur')
    expect(byTestId('panel-error')).not.toBeNull()
    expect(text()).toContain('Couldn\'t load this Pokemon')
    expect(byTestId('catch-toggle')).toBeNull()

    detailsStatus = {}
    byTestId('panel-retry')!.click()
    await flushPromises()
    await new Promise(r => setTimeout(r, 30))
    await flushPromises()

    expect(byTestId('panel-error')).toBeNull()
    expect(byTestId('panel-name')?.textContent).toBe('Bulbasaur')
  })

  it('shows "not found" without a retry for an unknown Pokemon', async () => {
    detailsStatus = { bulbasaur: 404 }
    wrapper = await openPanel('bulbasaur')
    expect(text()).toContain('Pokemon not found')
    expect(byTestId('panel-retry')).toBeNull()
  })
})

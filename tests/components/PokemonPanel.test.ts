import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PokemonPanel from '~/components/PokemonPanel.vue'

const bulbasaur = {
  id: 1,
  name: 'bulbasaur',
  height: 7,
  abilities: ['overgrow', 'chlorophyll'],
  types: ['grass', 'poison'],
  image: { url: 'https://example.test/shiny/1.png', shiny: true }
}
const charmander = {
  id: 4,
  name: 'charmander',
  height: 6,
  abilities: ['blaze'],
  types: ['fire'],
  image: { url: 'https://example.test/4.png', shiny: false }
}

let caught = new Set<string>()
registerEndpoint('/api/pokemon/bulbasaur', () => bulbasaur)
registerEndpoint('/api/pokemon/charmander', () => charmander)
registerEndpoint('/api/collection/bulbasaur', {
  method: 'PUT',
  handler: () => {
    caught.add('bulbasaur')
    return null
  }
})
registerEndpoint('/api/collection/bulbasaur', {
  method: 'DELETE',
  handler: () => {
    caught.delete('bulbasaur')
    return null
  }
})

async function openPanel(name: string) {
  useCollection().names.value = [...caught]
  const wrapper = await mountSuspended(PokemonPanel, { route: `/?pokemon=${name}` })
  await settle()
  return wrapper
}

async function settle() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 50))
}

// Slideover content is teleported to <body>.
const panelText = () => document.body.textContent ?? ''
const q = (testId: string) => document.body.querySelector(`[data-testid="${testId}"]`)

describe('PokemonPanel', () => {
  beforeEach(() => {
    caught = new Set()
  })

  it('renders name, height (converted from decimetres), abilities and image', async () => {
    await openPanel('bulbasaur')
    expect(q('panel-name')?.textContent).toContain('Bulbasaur')
    expect(q('panel-height')?.textContent).toContain('0.7 m')
    expect(q('panel-abilities')?.textContent).toContain('Overgrow')
    expect(q('panel-abilities')?.textContent).toContain('Chlorophyll')
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe(bulbasaur.image.url)
  })

  it('shows the Shiny badge only for shiny Pokemon', async () => {
    await openPanel('bulbasaur')
    expect(q('shiny-badge')).not.toBeNull()
    await navigateTo({ path: '/', query: { pokemon: 'charmander' } })
    await settle()
    expect(panelText()).toContain('Charmander')
    expect(q('shiny-badge')).toBeNull()
  })

  it('flips Catch to Remove and back', async () => {
    await openPanel('bulbasaur')
    const button = () => q('catch-toggle') as HTMLButtonElement
    expect(button().textContent).toContain('Catch')

    button().click()
    await settle()
    expect(caught.has('bulbasaur')).toBe(true)
    expect(button().textContent).toContain('Remove')

    button().click()
    await settle()
    expect(caught.has('bulbasaur')).toBe(false)
    expect(button().textContent).toContain('Catch')
  })

  it('shows Remove straight away for an already caught Pokemon', async () => {
    caught.add('bulbasaur')
    await openPanel('bulbasaur')
    expect((q('catch-toggle') as HTMLButtonElement).textContent).toContain('Remove')
  })
})

import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PokemonImage from '../../app/components/PokemonImage.vue'

const SHINY = 'https://img.test/official-artwork/shiny/1.png'
const DEFAULT = 'https://img.test/official-artwork/1.png'

describe('PokemonImage', () => {
  it('shows the Shiny badge only for a shiny image', async () => {
    const shiny = await mountSuspended(PokemonImage, { props: { url: SHINY, shiny: true, alt: 'Bulbasaur' } })
    expect(shiny.find('[data-testid="shiny-badge"]').exists()).toBe(true)
    expect(shiny.find('img').attributes('src')).toBe(SHINY)

    const plain = await mountSuspended(PokemonImage, { props: { url: DEFAULT, shiny: false, alt: 'Charmander' } })
    expect(plain.find('[data-testid="shiny-badge"]').exists()).toBe(false)
  })

  it('falls back to the default image, without the badge, when the shiny one fails to load', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { url: SHINY, shiny: true, alt: 'Bulbasaur' } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').attributes('src')).toBe(DEFAULT)
    expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(false)
  })

  it('shows a placeholder when there is no image', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { url: null, shiny: false, alt: 'Missing' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No image')
  })

  it('does not show a badge when a shiny Pokemon has no image', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { url: null, shiny: true, alt: 'Missing' } })
    expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(false)
  })

  it('falls back when the image had already failed before the component mounted (server-rendered)', async () => {
    // Simulates the browser having loaded the SSR <img> and failed it before hydration.
    const proto = HTMLImageElement.prototype
    const complete = Object.getOwnPropertyDescriptor(proto, 'complete')
    const naturalWidth = Object.getOwnPropertyDescriptor(proto, 'naturalWidth')
    Object.defineProperty(proto, 'complete', { configurable: true, get: () => true })
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 0 })
    try {
      const wrapper = await mountSuspended(PokemonImage, { props: { url: SHINY, shiny: true, alt: 'Bulbasaur' } })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('img').attributes('src')).toBe(DEFAULT)
      expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(false)
    } finally {
      if (complete) Object.defineProperty(proto, 'complete', complete)
      else delete (proto as unknown as Record<string, unknown>).complete
      if (naturalWidth) Object.defineProperty(proto, 'naturalWidth', naturalWidth)
      else delete (proto as unknown as Record<string, unknown>).naturalWidth
    }
  })
})

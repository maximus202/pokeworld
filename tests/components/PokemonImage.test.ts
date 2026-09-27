import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PokemonImage from '~/components/PokemonImage.vue'

const props = { url: 'https://example.test/shiny/1.png', alt: 'Bulbasaur' }

describe('PokemonImage', () => {
  it('shows the Shiny badge when shiny', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { ...props, shiny: true } })
    expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe(props.url)
  })

  it('hides the badge when not shiny', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { ...props, shiny: false } })
    expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(false)
  })

  it('falls back to the default image and drops the badge when the shiny image fails', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { ...props, shiny: true } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').attributes('src')).toBe('https://example.test/1.png')
    expect(wrapper.find('[data-testid="shiny-badge"]').exists()).toBe(false)
  })

  it('renders a placeholder without an image url', async () => {
    const wrapper = await mountSuspended(PokemonImage, { props: { url: null, shiny: false, alt: 'x' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No image')
  })
})

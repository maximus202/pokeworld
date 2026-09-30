import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PokemonImage from '~/components/PokemonImage.vue'

const SHINY = 'https://img.test/official-artwork/shiny/1.png'
const DEFAULT = 'https://img.test/official-artwork/1.png'
const mount = (props: { url: string | null, shiny: boolean }) => mountSuspended(PokemonImage, { props: { ...props, alt: 'Bulbasaur' } })

describe('PokemonImage', () => {
  it('shows the image with its alt text and no badge for a default image', async () => {
    const wrapper = await mount({ url: DEFAULT, shiny: false })
    expect(wrapper.find('img').attributes()).toMatchObject({ src: DEFAULT, alt: 'Bulbasaur' })
    expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(false)
  })

  it('shows the Shiny badge only for a shiny image', async () => {
    const wrapper = await mount({ url: SHINY, shiny: true })
    expect(wrapper.find('[data-testid=shiny-badge]').text()).toContain('Shiny')
  })

  it('falls back to the default image, without the badge, when the shiny image fails to load', async () => {
    const wrapper = await mount({ url: SHINY, shiny: true })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').attributes('src')).toBe(DEFAULT)
    expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(false)
  })

  it('shows "No image", not a broken image, when a default image fails to load', async () => {
    const wrapper = await mount({ url: DEFAULT, shiny: false })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No image')
  })

  it('shows "No image", without the badge, when the shiny image and then the default both fail', async () => {
    const wrapper = await mount({ url: SHINY, shiny: true })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').attributes('src')).toBe(DEFAULT)

    await wrapper.find('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No image')
    expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(false)
  })

  it('tries the new image again when the URL changes after everything failed', async () => {
    const wrapper = await mount({ url: DEFAULT, shiny: false })
    await wrapper.find('img').trigger('error')
    await wrapper.setProps({ url: 'https://img.test/official-artwork/2.png' })
    expect(wrapper.find('img').attributes('src')).toContain('/2.png')
  })

  it('shows "No image", and no badge, when there is no URL', async () => {
    const wrapper = await mount({ url: null, shiny: true })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No image')
    expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(false)
  })

  it('shows the shiny image again when the URL changes after a failure', async () => {
    const wrapper = await mount({ url: SHINY, shiny: true })
    await wrapper.find('img').trigger('error')
    await wrapper.setProps({ url: 'https://img.test/official-artwork/shiny/2.png' })
    expect(wrapper.find('img').attributes('src')).toContain('/shiny/2.png')
    expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(true)
  })

  describe('an image that already failed before the component mounted (server-rendered)', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete')!
    afterEach(() => Object.defineProperty(HTMLImageElement.prototype, 'complete', original))

    it('falls back on mount even though no error event reaches it', async () => {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true })
      const wrapper = await mount({ url: SHINY, shiny: true })
      expect(wrapper.find('img').attributes('src')).toBe(DEFAULT)
      expect(wrapper.find('[data-testid=shiny-badge]').exists()).toBe(false)
    })
  })
})

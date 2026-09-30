import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PokemonCard from '~/components/PokemonCard.vue'

const pokemon = { id: 1, name: 'bulbasaur', shiny: true, imageUrl: 'https://img.test/shiny/1.png' }
const mount = (props: Record<string, unknown> = {}, route = '/') => mountSuspended(PokemonCard, { props: { pokemon, ...props }, route })

describe('PokemonCard', () => {
  it('shows the number, the name and a link that opens the details panel', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).toContain('#0001')
    expect(wrapper.text()).toContain('Bulbasaur')
    expect(wrapper.find('a').attributes('href')).toBe('/?pokemon=bulbasaur')
  })

  it('keeps the screen and filters you are on, so closing the panel returns to them', async () => {
    const wrapper = await mount({}, '/?q=bulb&type=grass&caught=true')
    const href = wrapper.find('a').attributes('href')!
    expect(new URLSearchParams(href.split('?')[1]).toString()).toBe('q=bulb&type=grass&caught=true&pokemon=bulbasaur')
  })

  it('shows the Caught badge only when asked to', async () => {
    expect((await mount()).find('[data-testid=caught-badge]').exists()).toBe(false)
    expect((await mount({ caught: true })).find('[data-testid=caught-badge]').text()).toBe('Caught')
  })

  it('shows the caught date, with the exact time in a tooltip, only when given', async () => {
    expect((await mount()).find('[data-testid=caught-date]').exists()).toBe(false)
    const date = (await mount({ caughtAt: '2026-09-28T14:03:11.402Z' })).find('[data-testid=caught-date]')
    expect(date.text()).toMatch(/^Caught Sep (28|29), 2026$/)
    expect(date.attributes('title')).toMatch(/2026/)
  })

  it('has no remove button unless removable, and then emits remove without opening the panel', async () => {
    expect((await mount()).find('[data-testid=remove-button]').exists()).toBe(false)

    const wrapper = await mount({ removable: true })
    const button = wrapper.find('[data-testid=remove-button]')
    expect(button.attributes('aria-label')).toBe('Remove Bulbasaur')
    await button.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.find('a').element.contains(button.element)).toBe(false)
  })
})

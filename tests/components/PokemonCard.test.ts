import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PokemonCard from '../../app/components/PokemonCard.vue'
import PokemonErrorCard from '../../app/components/PokemonErrorCard.vue'

const pokemon = { id: 1, name: 'bulbasaur', imageUrl: 'https://img.test/official-artwork/shiny/1.png', shiny: true }

describe('PokemonCard', () => {
  it('shows the number, name and Shiny badge', async () => {
    const card = await mountSuspended(PokemonCard, { props: { pokemon } })
    expect(card.text()).toContain('#0001')
    expect(card.text()).toContain('Bulbasaur')
    expect(card.find('[data-testid="shiny-badge"]').exists()).toBe(true)
  })

  it('shows the Caught badge only when caught', async () => {
    const yes = await mountSuspended(PokemonCard, { props: { pokemon, caught: true } })
    const no = await mountSuspended(PokemonCard, { props: { pokemon } })
    expect(yes.find('[data-testid="caught-badge"]').exists()).toBe(true)
    expect(no.find('[data-testid="caught-badge"]').exists()).toBe(false)
  })

  it('shows when it was caught, in the viewer\'s local time', async () => {
    const card = await mountSuspended(PokemonCard, { props: { pokemon, caughtAt: '2026-09-28T14:03:11.402Z' } })
    const shown = card.find('[data-testid="caught-date"]').text()
    expect(shown).toBe(`Caught ${new Date('2026-09-28T14:03:11.402Z').toLocaleDateString('en-US', { dateStyle: 'medium' })}`)
  })

  it('has no date or remove button by default', async () => {
    const card = await mountSuspended(PokemonCard, { props: { pokemon } })
    expect(card.find('[data-testid="caught-date"]').exists()).toBe(false)
    expect(card.find('[data-testid="remove-button"]').exists()).toBe(false)
  })

  it('has a labelled remove button that emits without following the card link', async () => {
    const card = await mountSuspended(PokemonCard, { props: { pokemon, removable: true } })
    const button = card.find('[data-testid="remove-button"]')
    expect(button.attributes('aria-label')).toBe('Remove Bulbasaur')
    // The button is a sibling of the link, not inside it.
    expect(card.find('a [data-testid="remove-button"]').exists()).toBe(false)
    await button.trigger('click')
    expect(card.emitted('remove')).toHaveLength(1)
  })
})

describe('PokemonErrorCard', () => {
  it('names the Pokemon, shows its date, and offers retry and remove', async () => {
    const card = await mountSuspended(PokemonErrorCard, { props: { name: 'mr-mime', caughtAt: '2026-09-28T14:03:11.402Z' } })
    expect(card.text()).toContain('Mr Mime')
    expect(card.text()).toContain('Couldn\'t load details')
    expect(card.text()).toContain('Caught')

    await card.find('[data-testid="retry-button"]').trigger('click')
    await card.find('[data-testid="remove-button"]').trigger('click')
    expect(card.emitted('retry')).toHaveLength(1)
    expect(card.emitted('remove')).toHaveLength(1)
  })
})

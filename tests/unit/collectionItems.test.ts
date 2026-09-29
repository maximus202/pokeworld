import { describe, expect, it } from 'vitest'
import type { PokemonDetails } from '#shared/types/pokemon'
import { toCollectionItems } from '../../server/utils/pokemonView'

const details = (id: number, name: string, image: PokemonDetails['image']): PokemonDetails =>
  ({ id, name, height: 7, abilities: [], types: [], image })

const entries = [
  { name: 'bulbasaur', caughtAt: '2026-09-28T14:02:00.000Z' },
  { name: 'charmander', caughtAt: '2026-09-28T14:01:00.000Z' },
  { name: 'lotad', caughtAt: '2026-09-28T14:00:00.000Z' },
]

describe('toCollectionItems', () => {
  it('keeps an entry whose details cannot be loaded, with pokemon: null, so the count stays right', async () => {
    const lookup = async (name: string) => {
      if (name === 'charmander') throw new Error('PokeAPI request failed')
      return details(1, name, { url: 'https://example.test/x.png', shiny: true })
    }

    const items = await toCollectionItems(entries, lookup)

    expect(items.map(i => i.name)).toEqual(['bulbasaur', 'charmander', 'lotad'])
    expect(items[1]).toEqual({ name: 'charmander', caughtAt: entries[1]!.caughtAt, pokemon: null })
    expect(items[0]!.pokemon).toEqual({ id: 1, name: 'bulbasaur', shiny: true, imageUrl: 'https://example.test/x.png' })
  })

  it('has a null image URL when the Pokemon has no image', async () => {
    const [item] = await toCollectionItems(entries.slice(0, 1), async name => details(1, name, { url: null, shiny: false }))
    expect(item!.pokemon).toEqual({ id: 1, name: 'bulbasaur', shiny: false, imageUrl: null })
  })
})

import { describe, expect, it, vi } from 'vitest'
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

  it('logs why an entry could not be loaded, so a real failure is not invisible', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lookup = async (name: string) => {
      if (name === 'charmander') throw Object.assign(new Error('boom'), { statusCode: 502, statusMessage: 'PokeAPI request failed' })
      throw new TypeError('toDetails is broken')
    }

    await toCollectionItems(entries.slice(1, 3), lookup)

    const logged = warn.mock.calls.map(call => call.join(' '))
    expect(logged).toEqual([
      expect.stringContaining('charmander'),
      expect.stringContaining('lotad'),
    ])
    expect(logged[0]).toContain('PokeAPI request failed')
    expect(logged[1]).toContain('toDetails is broken')
    warn.mockRestore()
  })
})

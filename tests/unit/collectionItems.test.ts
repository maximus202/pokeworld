import { describe, expect, it, vi } from 'vitest'
import type { PokedexEntry } from '../../server/utils/pokeapi'
import { toCollectionItems } from '../../server/utils/pokemonView'

// The cached Pokemon list and the set of Grass Pokemon: all a collection item is built from.
const index: PokedexEntry[] = [
  { id: 1, name: 'bulbasaur' },
  { id: 4, name: 'charmander' },
  { id: 270, name: 'lotad' },
]
const catalogue = async () => [index, new Set(['bulbasaur', 'lotad'])] as [PokedexEntry[], Set<string>]

const entries = [
  { name: 'lotad', caughtAt: '2026-09-28T16:00:00.000Z' },
  { name: 'charmander', caughtAt: '2026-09-28T15:00:00.000Z' },
  { name: 'bulbasaur', caughtAt: '2026-09-28T14:00:00.000Z' },
]

describe('toCollectionItems', () => {
  it('builds each item from the cached list, in the order and with the dates it was given', async () => {
    const items = await toCollectionItems(entries, catalogue)

    expect(items.map(i => [i.name, i.caughtAt])).toEqual(entries.map(e => [e.name, e.caughtAt]))
    expect(items[2]!.pokemon).toEqual({
      id: 1,
      name: 'bulbasaur',
      shiny: true,
      imageUrl: expect.stringMatching(/\/official-artwork\/shiny\/1\.png$/),
    })
    expect(items[1]!.pokemon).toEqual({
      id: 4,
      name: 'charmander',
      shiny: false,
      imageUrl: expect.stringMatching(/\/official-artwork\/4\.png$/),
    })
  })

  it('keeps a name that is not in the list in its place, with pokemon: null, so the count stays right', async () => {
    const items = await toCollectionItems([...entries, { name: 'gone', caughtAt: '2026-09-27T00:00:00.000Z' }], catalogue)

    expect(items).toHaveLength(4)
    expect(items[3]).toEqual({ name: 'gone', caughtAt: '2026-09-27T00:00:00.000Z', pokemon: null })
    expect(items[0]!.pokemon).not.toBeNull()
  })

  it('keeps every entry, with pokemon: null, and says why, when the list cannot be loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = async (): Promise<[PokedexEntry[], Set<string>]> => {
      throw Object.assign(new Error('boom'), { statusCode: 502, statusMessage: 'PokeAPI request failed' })
    }

    const items = await toCollectionItems(entries, failing)

    expect(items.map(i => i.name)).toEqual(['lotad', 'charmander', 'bulbasaur']) // the count is right
    expect(items.every(i => i.pokemon === null)).toBe(true)
    expect(warn.mock.calls.join(' ')).toContain('PokeAPI request failed')
    warn.mockRestore()
  })

  it('asks for the list once, however many Pokemon are caught, instead of looking each one up', async () => {
    const source = vi.fn(catalogue)
    const many = Array.from({ length: 500 }, (_, i) => ({ name: i % 2 ? 'lotad' : 'charmander', caughtAt: `2026-09-28T14:00:${String(i % 60).padStart(2, '0')}.000Z` }))

    await toCollectionItems(many, source)

    expect(source).toHaveBeenCalledTimes(1)
  })
})

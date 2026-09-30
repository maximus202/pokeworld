import { describe, expect, it } from 'vitest'
import type { PokemonDetails, PokemonListResponse } from '#shared/types/pokemon'
import { visitor } from './helpers'
import bulbasaur from '../fixtures/pokemon/bulbasaur.json'
import spriteonly from '../fixtures/pokemon/spriteonly.json'

const v = visitor()
const list = (query = '') => v.json<PokemonListResponse>(`/api/pokemon${query}`)
const details = (name: string) => v.json<PokemonDetails>(`/api/pokemon/${name}`)
const names = (r: { body: PokemonListResponse }) => r.body.items.map(i => i.name)

describe('GET /api/types', () => {
  it('lists the types to filter by, without the ones that have no Pokemon', async () => {
    const { status, body } = await v.json<{ types: string[] }>('/api/types')
    expect(status).toBe(200)
    expect(body.types).toEqual(expect.arrayContaining(['grass', 'fire', 'water']))
    expect(body.types).not.toEqual(expect.arrayContaining(['unknown']))
    expect(body.types).not.toEqual(expect.arrayContaining(['shadow']))
    expect(body.types).not.toEqual(expect.arrayContaining(['stellar']))
  })
})

describe('GET /api/pokemon/:name', () => {
  it('returns the required fields', async () => {
    const { status, body } = await details('bulbasaur')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: bulbasaur.id,
      name: 'bulbasaur',
      height: bulbasaur.height, // decimetres, converted by the UI
      abilities: bulbasaur.abilities.map(a => a.ability.name),
      types: ['grass', 'poison'],
    })
  })

  it('shows the shiny image for grass as the primary type', async () => {
    const { body } = await details('bulbasaur')
    expect(body.image).toEqual({ url: expect.stringContaining('/shiny/1.png'), shiny: true })
  })

  it('shows the shiny image for grass as the secondary type', async () => {
    expect((await details('lotad')).body.image.shiny).toBe(true)
  })

  it('shows the default image for a non-grass Pokemon', async () => {
    const { body } = await details('charmander')
    expect(body.image).toEqual({ url: expect.stringContaining('/4.png'), shiny: false })
  })

  it('falls back to the plain sprite when there is no official artwork', async () => {
    expect((await details('spriteonly')).body.image).toEqual({ url: spriteonly.sprites.front_default, shiny: false })
  })

  it('is case-insensitive', async () => {
    expect((await details('BULBASAUR')).body.name).toBe('bulbasaur')
  })

  it.each(['missingno', 'deoxys-attack'])('returns 404 for %s, which is not a Pokedex entry', async (name) => {
    expect((await details(name)).status).toBe(404)
  })
})

describe('GET /api/pokemon', () => {
  it('returns items with an id, name, image and shiny flag, and the total', async () => {
    const { status, body } = await list()
    expect(status).toBe(200)
    expect(body.items[0]).toEqual({
      id: 1,
      name: 'bulbasaur',
      shiny: true,
      imageUrl: expect.stringContaining('/shiny/1.png'),
    })
    expect(body.total).toBe(30) // the fixture index has 31 entries; deoxys-attack is an alternate form
  })

  it('pages without gaps or repeats', async () => {
    const pages = await Promise.all([0, 10, 20, 30].map(offset => list(`?limit=10&offset=${offset}`)))
    const all = pages.flatMap(names)
    expect(all).toHaveLength(30)
    expect(new Set(all).size).toBe(30)
    expect(all).toEqual(names(await list('?limit=100')))
    expect(pages[3]!.body.items).toEqual([])
  })

  it('defaults to 24 per page and clamps limit and offset', async () => {
    expect((await list()).body.items).toHaveLength(24)
    expect((await list('?limit=1000')).body.items).toHaveLength(30)
    expect((await list('?limit=0')).body.items).toHaveLength(1)
    expect((await list('?limit=abc&offset=-5')).body.items).toHaveLength(24)
  })

  it.each(['5abc', '5.9', ''])('ignores the non-whole-number limit "%s"', async (limit) => {
    expect((await list(`?limit=${limit}`)).body.items).toHaveLength(24)
  })

  it('uses the first value when a parameter is repeated', async () => {
    expect(names(await list('?q=bulb&q=char'))).toEqual(['bulbasaur'])
    expect((await list('?type=grass&type=fire')).body.total).toBe(6)
  })

  it('searches names case-insensitively by substring', async () => {
    expect(names(await list('?q=BULB'))).toEqual(['bulbasaur'])
    expect(names(await list('?q=saur'))).toEqual(['bulbasaur', 'ivysaur', 'venusaur'])
  })

  it('returns an empty list, with a total of 0, when nothing matches', async () => {
    expect((await list('?q=zzz')).body).toEqual({ items: [], total: 0 })
  })

  it('filters by type, including Pokemon with that type in a second slot', async () => {
    expect(names(await list('?type=grass'))).toEqual(['bulbasaur', 'ivysaur', 'venusaur', 'lotad', 'lombre', 'ludicolo'])
  })

  it('combines the type filter with search', async () => {
    expect(names(await list('?type=grass&q=lot'))).toEqual(['lotad'])
    expect((await list('?type=fire&q=lot')).body.total).toBe(0)
  })

  it.each(['Grass', ' GRASS '])('matches the type "%s" case-insensitively', async (type) => {
    expect((await list(`?type=${encodeURIComponent(type)}`)).body.total).toBe(6)
  })

  it.each(['nope', 'shadow'])('returns 404 for the type "%s"', async (type) => {
    expect((await list(`?type=${type}`)).status).toBe(404)
  })

  it('marks grass Pokemon as shiny with a shiny image, and agrees with the details route', async () => {
    const { body } = await list('?limit=100')
    for (const name of ['bulbasaur', 'lotad', 'charmander']) {
      const item = body.items.find(i => i.name === name)!
      expect(item.shiny).toBe((await details(name)).body.image.shiny)
      expect(item.imageUrl.includes('/shiny/')).toBe(item.shiny)
    }
  })
})

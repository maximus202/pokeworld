import { beforeEach, describe, expect, it } from 'vitest'
import type { PokemonDetails, PokemonList } from '../../shared/types/pokemon'
import { fixture, visitor } from './helpers'

const v = visitor()
const list = (qs = '') => v.json<PokemonList>(`/api/pokemon${qs}`)

beforeEach(async () => {
  await fixture().reset()
})

describe('GET /api/pokemon', () => {
  it('returns items with id, name, imageUrl and shiny, plus the total', async () => {
    const { status, body } = await list()
    expect(status).toBe(200)
    expect(body.total).toBe(30)
    expect(body.items[0]).toEqual({
      id: 1,
      name: 'bulbasaur',
      imageUrl: expect.stringContaining('/official-artwork/shiny/1.png'),
      shiny: true
    })
  })

  it('pages through the list without gaps or repeats', async () => {
    const seen: string[] = []
    for (let offset = 0; offset < 30; offset += 5) {
      const { body } = await list(`?limit=5&offset=${offset}`)
      seen.push(...body.items.map(i => i.name))
    }
    const all = (await list('?limit=100')).body.items.map(i => i.name)
    expect(seen).toEqual(all)
    expect(new Set(seen)).toHaveProperty('size', 30)
  })

  it('clamps limit and ignores bad numbers', async () => {
    expect((await list('?limit=0')).body.items).toHaveLength(1)
    expect((await list('?limit=abc&offset=-4')).body.items).toHaveLength(24)
  })

  it('searches by case-insensitive substring', async () => {
    const { body } = await list('?q=BULB')
    expect(body.items.map(i => i.name)).toEqual(['bulbasaur'])
    expect(body.total).toBe(1)
    expect((await list('?q=saur')).body.items.map(i => i.name)).toEqual(['bulbasaur', 'ivysaur', 'venusaur'])
  })

  it('returns an empty list when nothing matches', async () => {
    expect((await list('?q=zzz')).body).toEqual({ total: 0, items: [] })
  })

  it('marks grass Pokemon shiny in any slot, and others not', async () => {
    const { body } = await list('?limit=100')
    const shiny = Object.fromEntries(body.items.map(i => [i.name, i.shiny]))
    expect(shiny.bulbasaur).toBe(true)
    expect(shiny.lotad).toBe(true)
    expect(shiny.charmander).toBe(false)
    expect(body.items.find(i => i.name === 'charmander')!.imageUrl).toMatch(/official-artwork\/4\.png$/)
  })

  it('filters by type, including Pokemon with that type in a secondary slot', async () => {
    const grass = (await list('?type=grass&limit=100')).body.items.map(i => i.name)
    expect(grass).toEqual(['bulbasaur', 'ivysaur', 'venusaur', 'lotad', 'lombre', 'ludicolo'])
    expect(grass).toContain('lotad')
  })

  it('combines type with search', async () => {
    expect((await list('?type=grass&q=bulb')).body.items.map(i => i.name)).toEqual(['bulbasaur'])
    expect((await list('?type=fire&q=bulb')).body).toEqual({ total: 0, items: [] })
    expect((await list('?type=water&q=lo')).body.items.map(i => i.name)).toEqual(['lotad', 'lombre', 'ludicolo'])
  })

  it('returns 404 for an unknown type and 400 for a malformed one', async () => {
    expect((await list('?type=nonsense')).status).toBe(404)
    expect((await list('?type=Not%20A%20Type!')).status).toBe(400)
  })
})

describe('alternate forms', () => {
  it('are left out of the list and search, so the list holds only Pokedex entries', async () => {
    const all = (await list('?limit=100')).body
    expect(all.total).toBe(30)
    expect(all.items.map(i => i.name)).not.toContain('deoxys-attack')
    expect(all.items.every(i => i.id < 10000)).toBe(true)
    expect((await list('?q=deoxys')).body).toEqual({ total: 0, items: [] })
  })

  it('cannot be opened, because only the app\'s own Pokemon exist', async () => {
    expect((await v.json('/api/pokemon/deoxys-attack')).status).toBe(404)
  })
})

describe('unknown names', () => {
  it('are rejected without asking PokeAPI', async () => {
    await v.json('/api/pokemon') // make sure the index is cached
    await fixture().reset()
    expect((await v.json('/api/pokemon/zzz-not-real')).status).toBe(404)
    expect((await v.json('/api/pokemon/deoxys-attack')).status).toBe(404)
    expect((await fixture().counts())['/pokemon/zzz-not-real']).toBeUndefined()
    expect((await fixture().counts())['/pokemon/deoxys-attack']).toBeUndefined()
  })
})

describe('GET /api/types', () => {
  it('lists the types, without the ones that have no Pokemon', async () => {
    const { body } = await v.json<{ types: string[] }>('/api/types')
    expect(body.types).toContain('grass')
    expect(body.types).toContain('fire')
    expect(body.types).not.toContain('unknown')
    expect(body.types).not.toContain('stellar')
  })
})

describe('GET /api/pokemon/:name', () => {
  it('returns the details with height in decimetres', async () => {
    const { status, body } = await v.json<PokemonDetails>('/api/pokemon/bulbasaur')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 1,
      name: 'bulbasaur',
      height: 7,
      abilities: ['overgrow', 'chlorophyll'],
      types: ['grass', 'poison']
    })
    expect(body.image.shiny).toBe(true)
  })

  it('reports the shiny flag for grass in a secondary slot, and default otherwise', async () => {
    expect((await v.json<PokemonDetails>('/api/pokemon/lotad')).body.image.shiny).toBe(true)
    const fire = (await v.json<PokemonDetails>('/api/pokemon/charmander')).body
    expect(fire.image.shiny).toBe(false)
    expect(fire.image.url).toMatch(/official-artwork/)
  })

  it('agrees with the list about which Pokemon are shiny', async () => {
    const items = (await list('?limit=100')).body.items.filter(i => ['bulbasaur', 'lotad', 'charmander', 'squirtle'].includes(i.name))
    for (const item of items) {
      const details = (await v.json<PokemonDetails>(`/api/pokemon/${item.name}`)).body
      expect(details.image.shiny, item.name).toBe(item.shiny)
    }
  })

  it('falls back to the sprite when there is no official artwork', async () => {
    const { body } = await v.json<PokemonDetails>('/api/pokemon/spriteonly')
    expect(body.image).toEqual({ url: 'https://example.test/spriteonly.png', shiny: false })
  })

  it('returns 502 when PokeAPI fails', async () => {
    await fixture().failNext('/pokemon/wartortle')
    expect((await v.json('/api/pokemon/wartortle')).status).toBe(502)
  })

  it('returns 404 for an unknown Pokemon and 400 for a malformed name', async () => {
    expect((await v.json('/api/pokemon/missingno')).status).toBe(404)
    expect((await v.json('/api/pokemon/Bad%20Name!')).status).toBe(400)
  })
})

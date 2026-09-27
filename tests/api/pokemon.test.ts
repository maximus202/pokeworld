import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { startFixtureServer } from '../fixtures/server'

const fixture = await startFixtureServer()
afterAll(() => fixture.close())

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  nuxtConfig: { runtimeConfig: { pokeapiBaseUrl: fixture.url, dbPath: ':memory:' } }
})

interface ListItem { id: number, name: string, imageUrl: string, shiny: boolean }
interface List { total: number, items: ListItem[] }

describe('GET /api/pokemon', () => {
  it('returns { id, name, imageUrl } items with a total', async () => {
    const list = await $fetch<List>('/api/pokemon')
    expect(list.total).toBe(8)
    expect(list.items[0]).toEqual({
      id: 1,
      name: 'bulbasaur',
      imageUrl: expect.stringContaining('/official-artwork/shiny/1.png'),
      shiny: true
    })
  })

  it('uses shiny images for grass Pokemon in any slot, and default for the rest', async () => {
    const { items } = await $fetch<List>('/api/pokemon')
    const byName = Object.fromEntries(items.map(i => [i.name, i]))
    expect(byName.bulbasaur!.shiny).toBe(true)
    expect(byName.lotad!.shiny).toBe(true) // grass as secondary type
    expect(byName.charmander!.shiny).toBe(false)
    expect(byName.charmander!.imageUrl).toMatch(/official-artwork\/4\.png$/)
  })

  it('pages through the list with limit and offset without gaps or repeats', async () => {
    const all = await $fetch<List>('/api/pokemon?limit=100')
    const pages: ListItem[] = []
    for (let offset = 0; offset < all.total; offset += 3) {
      pages.push(...(await $fetch<List>(`/api/pokemon?limit=3&offset=${offset}`)).items)
    }
    expect(pages.map(p => p.name)).toEqual(all.items.map(p => p.name))
    expect(new Set(pages.map(p => p.name)).size).toBe(all.total)
  })

  it('searches by case-insensitive substring', async () => {
    const list = await $fetch<List>('/api/pokemon?q=BULB')
    expect(list.items.map(i => i.name)).toEqual(['bulbasaur'])
    expect(list.total).toBe(1)

    const char = await $fetch<List>('/api/pokemon?q=char')
    expect(char.items.map(i => i.name)).toEqual(['charmander', 'charmeleon', 'charizard'])
  })

  it('returns an empty list for an unmatched query', async () => {
    expect(await $fetch<List>('/api/pokemon?q=zzzzz')).toEqual({ total: 0, items: [] })
  })

  it('clamps bad limit and offset values', async () => {
    const list = await $fetch<List>('/api/pokemon?limit=-5&offset=abc')
    expect(list.items.length).toBeGreaterThan(0)
  })
})

describe('GET /api/pokemon/:name', () => {
  it('returns id, name, height (decimetres), abilities, types and image', async () => {
    expect(await $fetch('/api/pokemon/bulbasaur')).toEqual({
      id: 1,
      name: 'bulbasaur',
      height: 7,
      abilities: ['overgrow', 'chlorophyll'],
      types: ['grass', 'poison'],
      image: { url: expect.stringContaining('official-artwork/shiny/1.png'), shiny: true }
    })
  })

  it('reports shiny for grass as a secondary type', async () => {
    const lotad = await $fetch<{ image: { shiny: boolean } }>('/api/pokemon/lotad')
    expect(lotad.image.shiny).toBe(true)
  })

  it('reports the default image for non-grass', async () => {
    const charmander = await $fetch<{ image: { url: string, shiny: boolean } }>('/api/pokemon/charmander')
    expect(charmander.image.shiny).toBe(false)
    expect(charmander.image.url).toMatch(/official-artwork\/4\.png$/)
  })

  it('falls back to the plain sprite when official-artwork is missing', async () => {
    const p = await $fetch<{ image: { url: string, shiny: boolean } }>('/api/pokemon/spriteonly')
    expect(p.image).toEqual({ url: expect.stringMatching(/pokemon\/9001\.png$/), shiny: false })
  })

  it('is case-insensitive on the name', async () => {
    expect(await $fetch<{ name: string }>('/api/pokemon/BULBASAUR')).toMatchObject({ name: 'bulbasaur' })
  })

  it('returns 404 for an unknown name', async () => {
    const res = await fetch(new URL('/api/pokemon/notapokemon', (await import('@nuxt/test-utils/e2e')).url('/')))
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed name', async () => {
    const res = await fetch((await import('@nuxt/test-utils/e2e')).url('/api/pokemon/bad_name!'))
    expect(res.status).toBe(400)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import type { CollectionResponse, PokemonList } from '../../shared/types/pokemon'
import { collectionCap, del, fixture, put, visitor } from './helpers'

const collection = (v: ReturnType<typeof visitor>) => v.json<CollectionResponse>('/api/collection')

beforeEach(async () => {
  await fixture().reset()
})

describe('catching', () => {
  it('stores the catch and returns its name and an ISO 8601 UTC timestamp', async () => {
    const v = visitor()
    const { status, body } = await put(v, 'bulbasaur')
    expect(status).toBe(200)
    expect(body.name).toBe('bulbasaur')
    expect(body.caughtAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Math.abs(Date.now() - new Date(body.caughtAt).getTime())).toBeLessThan(60_000)
  })

  it('is idempotent and keeps the original date', async () => {
    const v = visitor()
    const first = await put(v, 'bulbasaur')
    await new Promise(r => setTimeout(r, 15))
    const second = await put(v, 'bulbasaur')
    expect(second.body.caughtAt).toBe(first.body.caughtAt)
    expect((await collection(v)).body.count).toBe(1)
  })

  it('lower-cases the name', async () => {
    const v = visitor()
    expect((await put(v, 'BULBASAUR')).body.name).toBe('bulbasaur')
  })

  it('rejects an unknown Pokemon with 404 and stores nothing', async () => {
    const v = visitor()
    expect((await put(v, 'missingno')).status).toBe(404)
    expect((await collection(v)).body).toEqual({ count: 0, items: [] })
  })

  it('rejects a malformed name with 400', async () => {
    const v = visitor()
    expect((await put(v, 'not%20valid!')).status).toBe(400)
  })

  it('returns 502 when PokeAPI cannot confirm the Pokemon, and stores nothing', async () => {
    const v = visitor()
    await fixture().failNext('/pokemon/spriteonly')
    expect((await put(v, 'spriteonly')).status).toBe(502)
    expect((await collection(v)).body.count).toBe(0)
  })

  it('returns 409 past the cap, but still accepts an already-caught Pokemon', async () => {
    const v = visitor()
    const names = ['bulbasaur', 'charmander', 'squirtle', 'lotad']
    expect(names).toHaveLength(collectionCap())
    for (const n of names) expect((await put(v, n)).status).toBe(200)

    expect((await put(v, 'spriteonly')).status).toBe(409)
    expect((await collection(v)).body.count).toBe(collectionCap())
    expect((await put(v, 'lotad')).status).toBe(200)
  })
})

describe('viewing the collection', () => {
  it('lists the caller\'s Pokemon most recent first, with the data the grid needs', async () => {
    const v = visitor()
    await put(v, 'bulbasaur')
    await new Promise(r => setTimeout(r, 15))
    await put(v, 'charmander')

    const { body } = await collection(v)
    expect(body.count).toBe(2)
    expect(body.items.map(i => i.name)).toEqual(['charmander', 'bulbasaur'])
    expect(body.items[0]).toEqual({
      name: 'charmander',
      caughtAt: expect.stringMatching(/Z$/),
      pokemon: { id: 4, name: 'charmander', imageUrl: expect.stringMatching(/official-artwork\/4\.png$/), shiny: false }
    })
    expect(body.items[1]!.pokemon).toMatchObject({ name: 'bulbasaur', shiny: true })
    expect(body.items[1]!.pokemon!.imageUrl).toMatch(/shiny\/1\.png$/)
  })
})

describe('removing and resetting', () => {
  it('removes one Pokemon, and removing again is a no-op', async () => {
    const v = visitor()
    await put(v, 'bulbasaur')
    await put(v, 'charmander')
    expect((await del(v, 'bulbasaur')).status).toBe(204)
    expect((await del(v, 'bulbasaur')).status).toBe(204)
    expect((await collection(v)).body.items.map(i => i.name)).toEqual(['charmander'])
  })

  it('resets the whole collection', async () => {
    const v = visitor()
    await put(v, 'bulbasaur')
    await put(v, 'charmander')
    expect((await v.json('/api/collection', { method: 'DELETE' })).status).toBe(204)
    expect((await collection(v)).body).toEqual({ count: 0, items: [] })
  })
})

describe('private collections (tenancy)', () => {
  it('never shows one visitor another visitor\'s catches', async () => {
    const a = visitor()
    const b = visitor()
    await put(a, 'bulbasaur')
    expect((await collection(b)).body.count).toBe(0)
    expect((await collection(a)).body.count).toBe(1)
  })

  it('never lets one visitor remove or reset another\'s catches', async () => {
    const a = visitor()
    const b = visitor()
    await put(a, 'bulbasaur')
    await put(b, 'bulbasaur')

    await del(b, 'bulbasaur')
    expect((await collection(a)).body.count).toBe(1)

    await put(b, 'charmander')
    await b.json('/api/collection', { method: 'DELETE' })
    expect((await collection(b)).body.count).toBe(0)
    expect((await collection(a)).body.items.map(i => i.name)).toEqual(['bulbasaur'])
  })

  it('keeps the same collection for the same cookie', async () => {
    const a = visitor()
    await put(a, 'bulbasaur')
    const again = visitor(a.id)
    expect((await collection(again)).body.items.map(i => i.name)).toEqual(['bulbasaur'])
  })

  it('gives each visitor their own date for the same Pokemon', async () => {
    const a = visitor()
    const b = visitor()
    const first = await put(a, 'lotad')
    await new Promise(r => setTimeout(r, 15))
    const second = await put(b, 'lotad')
    expect(second.body.caughtAt > first.body.caughtAt).toBe(true)
  })
})

describe('GET /api/pokemon?caught=true', () => {
  const caughtList = (v: ReturnType<typeof visitor>, qs = '') => v.json<PokemonList>(`/api/pokemon?caught=true${qs}`)

  it('returns only the caller\'s Pokemon with a correct total', async () => {
    const a = visitor()
    const b = visitor()
    await put(a, 'bulbasaur')
    await put(a, 'charmander')
    await put(b, 'squirtle')

    const { body } = await caughtList(a)
    expect(body.items.map(i => i.name)).toEqual(['bulbasaur', 'charmander'])
    expect(body.total).toBe(2)
    expect((await caughtList(b)).body.items.map(i => i.name)).toEqual(['squirtle'])
  })

  it('combines with search, type and paging', async () => {
    const v = visitor()
    await put(v, 'bulbasaur')
    await put(v, 'charmander')
    await put(v, 'lotad')

    expect((await caughtList(v, '&q=char')).body.items.map(i => i.name)).toEqual(['charmander'])
    expect((await caughtList(v, '&type=grass')).body.items.map(i => i.name)).toEqual(['bulbasaur', 'lotad'])
    const page = (await caughtList(v, '&limit=1&offset=1')).body
    expect(page.items.map(i => i.name)).toEqual(['charmander'])
    expect(page.total).toBe(3)
  })

  it('is empty when the visitor has caught nothing', async () => {
    expect((await caughtList(visitor())).body).toEqual({ total: 0, items: [] })
  })
})

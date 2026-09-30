import { describe, expect, it } from 'vitest'
import type { CollectionResponse, PokemonListResponse } from '#shared/types/pokemon'
import { baseUrl, collectionCap, visitor, type Visitor } from './helpers'

const catchIt = (v: Visitor, name: string) => v.json<{ name: string, caughtAt: string }>(`/api/collection/${name}`, { method: 'PUT' })
const remove = (v: Visitor, name: string) => v.json(`/api/collection/${name}`, { method: 'DELETE' })
const reset = (v: Visitor) => v.json('/api/collection', { method: 'DELETE' })
const collection = (v: Visitor) => v.json<CollectionResponse>('/api/collection')
const caughtNames = async (v: Visitor) => (await collection(v)).body.items.map(i => i.name)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('PUT /api/collection/:name (catch)', () => {
  it('stores the Pokemon and returns its name and an ISO 8601 UTC caught time', async () => {
    const v = visitor()
    const { status, body } = await catchIt(v, 'bulbasaur')
    expect(status).toBe(200)
    expect(body.name).toBe('bulbasaur')
    expect(body.caughtAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(await caughtNames(v)).toEqual(['bulbasaur'])
  })

  it('keeps the original date when the same Pokemon is caught again', async () => {
    const v = visitor()
    const first = await catchIt(v, 'lotad')
    await sleep(5)
    const second = await catchIt(v, 'lotad')
    expect(second.body).toEqual(first.body)
  })

  it('accepts an upper-case name', async () => {
    const v = visitor()
    expect((await catchIt(v, 'CHARMANDER')).body.name).toBe('charmander')
  })

  it('rejects an unknown Pokemon with 404 and stores nothing', async () => {
    const v = visitor()
    expect((await catchIt(v, 'missingno')).status).toBe(404)
    expect((await catchIt(v, 'deoxys-attack')).status).toBe(404) // an alternate form, not a Pokedex entry
    expect((await collection(v)).body.count).toBe(0)
  })

  it.each(['bad_name', 'a.b', 'x'.repeat(101)])('rejects the malformed name "%s" with 400', async (name) => {
    const v = visitor()
    expect((await catchIt(v, name)).status).toBe(400)
    expect((await collection(v)).body.count).toBe(0)
  })

  it('answers 409 when the collection is full, but still accepts a Pokemon already caught', async () => {
    const v = visitor()
    const names = ['bulbasaur', 'charmander', 'lotad', 'spriteonly', 'squirtle'] // one more than the test cap
    expect(names).toHaveLength(collectionCap() + 1)
    for (const name of names.slice(0, collectionCap())) expect((await catchIt(v, name)).status).toBe(200)

    expect((await catchIt(v, names.at(-1)!)).status).toBe(409)
    expect((await catchIt(v, 'lotad')).status).toBe(200)
    expect((await collection(v)).body.count).toBe(collectionCap())
  })
})

describe('GET /api/collection', () => {
  it('is empty for a visitor who has caught nothing', async () => {
    expect((await collection(visitor())).body).toEqual({ count: 0, items: [] })
  })

  it('lists the most recent catch first, with its date and list item, and the count matches', async () => {
    const v = visitor()
    await catchIt(v, 'bulbasaur')
    await sleep(5)
    await catchIt(v, 'charmander')

    const { body } = await collection(v)

    expect(body.count).toBe(2)
    expect(body.items.map(i => i.name)).toEqual(['charmander', 'bulbasaur'])
    expect(body.items[0]!.caughtAt).toMatch(/Z$/)
    expect(body.items[1]!.pokemon).toMatchObject({ id: 1, name: 'bulbasaur', shiny: true })
    expect(body.items[0]!.pokemon).toMatchObject({ id: 4, name: 'charmander', shiny: false })
  })
})

describe('removing and resetting', () => {
  it('removes one Pokemon, and removing it again is a no-op', async () => {
    const v = visitor()
    await catchIt(v, 'bulbasaur')
    await catchIt(v, 'lotad')

    expect((await remove(v, 'bulbasaur')).status).toBe(204)
    expect((await remove(v, 'bulbasaur')).status).toBe(204)

    expect(await caughtNames(v)).toEqual(['lotad'])
  })

  it('resets the whole collection', async () => {
    const v = visitor()
    await catchIt(v, 'bulbasaur')
    await catchIt(v, 'lotad')
    expect((await reset(v)).status).toBe(204)
    expect((await collection(v)).body.count).toBe(0)
  })

  it('rejects a malformed name on delete with 400', async () => {
    expect((await remove(visitor(), 'bad_name')).status).toBe(400)
  })
})

describe('tenancy: each visitor has a private collection', () => {
  it("never shows one visitor's catches to another", async () => {
    const [a, b] = [visitor(), visitor()]
    await catchIt(a, 'bulbasaur')
    expect((await collection(b)).body).toEqual({ count: 0, items: [] })
  })

  it("never lets one visitor's remove or reset touch another's collection", async () => {
    const [a, b] = [visitor(), visitor()]
    await catchIt(a, 'bulbasaur')
    await catchIt(b, 'bulbasaur')

    await remove(b, 'bulbasaur')
    expect(await caughtNames(a)).toEqual(['bulbasaur'])

    await catchIt(b, 'lotad')
    await reset(b)
    expect(await caughtNames(a)).toEqual(['bulbasaur'])
  })

  it('counts the cap per visitor', async () => {
    const [a, b] = [visitor(), visitor()]
    for (const name of ['bulbasaur', 'charmander', 'lotad', 'spriteonly']) await catchIt(a, name)
    expect((await catchIt(b, 'bulbasaur')).status).toBe(200)
  })
})

describe('GET /api/pokemon?caught=true', () => {
  const list = (v: Visitor, query: string) => v.json<PokemonListResponse>(`/api/pokemon?${query}`)

  it("returns only the caller's Pokemon, in Pokedex order, with a correct total", async () => {
    const v = visitor()
    await catchIt(v, 'lotad')
    await catchIt(v, 'bulbasaur')
    const { body } = await list(v, 'caught=true')
    expect(body.items.map(i => i.name)).toEqual(['bulbasaur', 'lotad'])
    expect(body.total).toBe(2)
  })

  it('combines with search and type', async () => {
    const v = visitor()
    for (const name of ['bulbasaur', 'lotad', 'charmander']) await catchIt(v, name)
    expect((await list(v, 'caught=true&q=lot')).body.items.map(i => i.name)).toEqual(['lotad'])
    expect((await list(v, 'caught=true&type=grass')).body.total).toBe(2)
    expect((await list(v, 'caught=true&type=fire&q=lot')).body.total).toBe(0)
  })

  it("never includes another visitor's catches", async () => {
    const [a, b] = [visitor(), visitor()]
    await catchIt(a, 'bulbasaur')
    expect((await list(b, 'caught=true')).body).toEqual({ items: [], total: 0 })
  })

  it('is empty when nothing is caught, and ignores any other value', async () => {
    const v = visitor()
    expect((await list(v, 'caught=true')).body).toEqual({ items: [], total: 0 })
    expect((await list(v, 'caught=false')).body.total).toBe(30)
  })

  it.each(['TRUE', ' true '])('treats caught=%j like caught=true', async (value) => {
    const v = visitor()
    await catchIt(v, 'bulbasaur')
    expect((await list(v, `caught=${encodeURIComponent(value)}`)).body.items.map(i => i.name)).toEqual(['bulbasaur'])
  })

  it('reflects a removal straight away', async () => {
    const v = visitor()
    await catchIt(v, 'bulbasaur')
    await remove(v, 'bulbasaur')
    expect((await list(v, 'caught=true')).body.total).toBe(0)
  })
})

describe('per-visitor responses are not shareable by caches', () => {
  const cacheControl = async (v: Visitor, path: string) => (await v.request(path)).headers.get('cache-control')

  it.each(['/api/collection', '/api/pokemon?caught=true', '/api/me'])('marks %s private', async (path) => {
    expect(await cacheControl(visitor(), path)).toBe('private, no-store')
  })

  it('marks any response that issues a cookie private, so a cache cannot hand one visitor another visitor\'s cookie', async () => {
    for (const path of ['/api/types', '/api/pokemon', '/api/pokemon/bulbasaur', '/']) {
      const res = await fetch(`${baseUrl()}${path}`) // no cookie, so this request is issued one
      expect(res.headers.get('set-cookie'), path).toMatch(/pokeworld_visitor=/)
      expect(res.headers.get('cache-control'), path).toBe('private, no-store')
    }
  })

  it('leaves the list that is the same for everyone alone once the visitor already has a cookie', async () => {
    const v = visitor()
    await v.request('/api/me') // gets the cookie; a response that issues one is private
    expect(await cacheControl(v, '/api/pokemon')).toBeNull()
    expect(await cacheControl(v, '/api/pokemon?caught=false')).toBeNull()
    expect(await cacheControl(v, '/api/pokemon/bulbasaur')).toBeNull()
  })
})

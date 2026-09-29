import { describe, expect, it } from 'vitest'
import { fixture, visitor } from './helpers'

const v = visitor()

// The server caches for the life of the process and is shared by every test, so each test here
// either warms a request first or uses a resource no other test touches (wartortle, type/water).
describe('PokeAPI caching', () => {
  it('serves repeated details, list, search and type requests without asking PokeAPI again', async () => {
    const requests = ['/api/types', '/api/pokemon/bulbasaur', '/api/pokemon?limit=5', '/api/pokemon?q=lot&type=fire']
    await Promise.all(requests.map(path => v.request(path)))
    await fixture().reset()

    await Promise.all(requests.map(path => v.request(path)))

    expect(await fixture().counts()).toEqual({})
  })

  it('answers an unknown name locally, without asking PokeAPI about it', async () => {
    await v.request('/api/pokemon/bulbasaur')
    await fixture().reset()

    expect((await v.json('/api/pokemon/missingno')).status).toBe(404)

    expect(await fixture().counts()).toEqual({})
  })

  it('does not cache a failure: a details request fails with 502, then succeeds', async () => {
    await v.request('/api/pokemon/bulbasaur') // warm the index
    await fixture().failNext('/pokemon/wartortle')

    const failed = await v.json<{ statusMessage: string }>('/api/pokemon/wartortle')
    expect(failed.status).toBe(502)
    expect(failed.body.statusMessage).toBe('PokeAPI request failed')
    expect((await v.json('/api/pokemon/wartortle')).status).toBe(200)
    expect((await fixture().counts())['/pokemon/wartortle']).toBe(2) // one attempt each, no hidden retry
  })

  it('does not cache a failure: a type filter fails with 502, then succeeds', async () => {
    await Promise.all([v.request('/api/pokemon'), v.request('/api/types')]) // warm the index and the type list
    await fixture().failNext('/type/water')

    expect((await v.json('/api/pokemon?type=water')).status).toBe(502)
    const retried = await v.json<{ total: number }>('/api/pokemon?type=water')
    expect(retried.status).toBe(200)
    expect(retried.body.total).toBe(6)
  })

  it('answers a 502, not a 500, when PokeAPI returns a body of the wrong shape, and does not cache it', async () => {
    await Promise.all([v.request('/api/pokemon'), v.request('/api/types')])
    await fixture().failNext('/type/normal', 'garbage')

    const bad = await v.json<{ statusMessage: string }>('/api/pokemon?type=normal')
    expect(bad.status).toBe(502)
    expect(bad.body.statusMessage).toBe('PokeAPI request failed')
    expect((await v.json<{ total: number }>('/api/pokemon?type=normal')).body.total).toBe(1)
  })
})

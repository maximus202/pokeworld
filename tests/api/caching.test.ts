import { describe, expect, it } from 'vitest'
import { fixture, visitor } from './helpers'

const v = visitor()

// The server caches for the life of the process and is shared by every test, so each test here
// either warms a request first or uses a resource no other test touches (squirtle, type/water).
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
    await fixture().failNext('/pokemon/squirtle')

    const failed = await v.json<{ statusMessage: string }>('/api/pokemon/squirtle')
    expect(failed.status).toBe(502)
    expect(failed.body.statusMessage).toBe('PokeAPI request failed')
    expect((await v.json('/api/pokemon/squirtle')).status).toBe(200)
    expect((await fixture().counts())['/pokemon/squirtle']).toBe(2) // one attempt each, no hidden retry
  })

  it('does not cache a failure: a type filter fails with 502, then succeeds', async () => {
    await v.request('/api/pokemon') // warm the index and the type list
    await fixture().failNext('/type/water')

    expect((await v.json('/api/pokemon?type=water')).status).toBe(502)
    const retried = await v.json<{ total: number }>('/api/pokemon?type=water')
    expect(retried.status).toBe(200)
    expect(retried.body.total).toBe(6)
  })
})

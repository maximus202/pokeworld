import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureControl, startFixtureServer, type FixtureServer } from '../fixtures/server'

let server: FixtureServer
let control: ReturnType<typeof fixtureControl>
const get = (path: string) => fetch(`${server.url}${path}`)

beforeAll(async () => {
  server = await startFixtureServer()
  control = fixtureControl(server.url)
})
afterAll(() => server.close())
beforeEach(() => control.reset())

describe('fixture server', () => {
  it('serves recorded PokeAPI shapes', async () => {
    const res = await get('/pokemon/bulbasaur')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.name).toBe('bulbasaur')
    expect(body.types.map((t: { type: { name: string } }) => t.type.name)).toEqual(['grass', 'poison'])
  })

  it('returns 404 for a Pokemon it has no fixture for', async () => {
    expect((await get('/pokemon/missingno')).status).toBe(404)
  })

  it('counts requests per path and resets', async () => {
    await get('/pokemon/lotad')
    await get('/pokemon/lotad')
    await get('/type/grass')
    expect(await control.counts()).toEqual({ '/pokemon/lotad': 2, '/type/grass': 1 })
    await control.reset()
    expect(await control.counts()).toEqual({})
  })

  it('fails only the next request for a path', async () => {
    await control.failNext('/pokemon/charmander')
    expect((await get('/pokemon/charmander')).status).toBe(500)
    expect((await get('/pokemon/charmander')).status).toBe(200)
  })

  it('fails every request until told to stop', async () => {
    await control.failAll()
    expect((await get('/pokemon/bulbasaur')).status).toBe(500)
    expect((await get('/type')).status).toBe(500)
    await control.failAll(false)
    expect((await get('/pokemon/bulbasaur')).status).toBe(200)
  })
})

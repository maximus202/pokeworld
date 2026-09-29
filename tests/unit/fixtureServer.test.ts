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

  it('does not let a queued failure fire after fail-all is switched off', async () => {
    await control.failNext('/pokemon/lotad')
    await control.failAll()
    expect((await get('/pokemon/lotad')).status).toBe(500)
    await control.failAll(false)
    expect((await get('/pokemon/lotad')).status).toBe(200)
  })

  it('returns only a small first page of a list endpoint unless a limit is given', async () => {
    expect((await (await get('/type')).json()).results.length).toBeLessThan(21)
    expect((await (await get('/type?limit=100')).json()).results).toHaveLength(21)
  })

  it('can return a 200 with a body of the wrong shape, once', async () => {
    await control.failNext('/type/fire', 'garbage')
    expect(await (await get('/type/fire')).json()).toEqual({ unexpected: true })
    expect((await (await get('/type/fire')).json()).pokemon).toBeTruthy()
  })

  it('rejects unknown control actions and non-POST control calls', async () => {
    const unknown = await fetch(`${server.url}/__control/fial`, { method: 'POST' })
    expect(unknown.status).toBe(400)
    const wrongMethod = await fetch(`${server.url}/__control/reset`)
    expect(wrongMethod.status).toBe(405)
  })
})

describe('fixture shapes match PokeAPI', () => {
  it('type index count matches its results and includes the types the app must exclude', async () => {
    const body = await (await get('/type?limit=100')).json()
    const names = body.results.map((t: { name: string }) => t.name)
    expect(body.count).toBe(names.length)
    expect(names).toEqual(expect.arrayContaining(['grass', 'unknown', 'shadow', 'stellar']))
  })

  it('a Pokemon without artwork still has an official-artwork object with null images', async () => {
    const body = await (await get('/pokemon/spriteonly')).json()
    expect(body.sprites.other['official-artwork']).toEqual({ front_default: null, front_shiny: null })
    expect(body.sprites.front_default).toBeTruthy()
  })
})

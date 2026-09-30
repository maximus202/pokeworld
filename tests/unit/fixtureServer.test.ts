import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureControl, startFixtureServer, type FixtureServer } from '../fixtures/server'

// Only what other tests depend on without being able to notice it going wrong. The counters and
// the failure switch are not tested here: the caching tests would fail if they broke.

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
  it('returns only a small first page of a list endpoint unless a limit is given, like PokeAPI', async () => {
    // This is what makes a request that forgets `limit` fail the API tests.
    expect((await (await get('/type')).json()).results.length).toBeLessThan(21)
    expect((await (await get('/type?limit=100')).json()).results).toHaveLength(21)
  })

  it('can answer with a 200 whose body is the wrong shape, once', async () => {
    // A plain 500 would also give a 502 in the app, so the status is what makes this a different case.
    await control.failNext('/type/fire', 'garbage')

    const bad = await get('/type/fire')
    expect(bad.status).toBe(200)
    expect(await bad.json()).toEqual({ unexpected: true })

    const next = await get('/type/fire')
    expect(next.status).toBe(200)
    expect((await next.json()).pokemon).toBeTruthy()
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

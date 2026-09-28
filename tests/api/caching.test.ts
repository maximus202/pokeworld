import { beforeEach, describe, expect, it } from 'vitest'
import { fixture, visitor } from './helpers'

const v = visitor()

beforeEach(async () => {
  await fixture().reset()
})

describe('PokeAPI caching', () => {
  it('fetches a Pokemon from upstream at most once', async () => {
    await v.json('/api/pokemon/squirtle')
    const afterFirst = await fixture().counts()
    await v.json('/api/pokemon/squirtle')
    await v.json('/api/pokemon/squirtle')
    expect(await fixture().counts()).toEqual(afterFirst)
    expect(afterFirst['/pokemon/squirtle'] ?? 0).toBeLessThanOrEqual(1)
  })

  it('serves repeated list and search calls from the cached index', async () => {
    await v.json('/api/pokemon')
    const afterFirst = await fixture().counts()
    await v.json('/api/pokemon?q=char')
    await v.json('/api/pokemon?limit=2&offset=2')
    expect(await fixture().counts()).toEqual(afterFirst)
    expect(afterFirst['/pokemon'] ?? 0).toBeLessThanOrEqual(1)
  })

  it('does not cache a failure: a list filter fails with 502, then recovers and is cached', async () => {
    await fixture().failNext('/type/poison')
    expect((await v.json('/api/pokemon?type=poison')).status).toBe(502)

    const ok = await v.json<{ total: number }>('/api/pokemon?type=poison')
    expect(ok.status).toBe(200)
    expect(ok.body.total).toBe(3)
    expect((await fixture().counts())['/type/poison']).toBe(2)

    await v.json('/api/pokemon?type=poison')
    expect((await fixture().counts())['/type/poison']).toBe(2)
  })
})

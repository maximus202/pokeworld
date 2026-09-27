import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { startFixtureServer } from '../fixtures/server'
import { newVisitor } from './helpers'

const fixture = await startFixtureServer()
afterAll(() => fixture.close())

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  nuxtConfig: { runtimeConfig: { pokeapiBaseUrl: fixture.url, dbPath: ':memory:' } }
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('visitor cookie', () => {
  it('issues an httpOnly, SameSite=Lax pokeworld_visitor cookie on first contact', async () => {
    const res = await fetch(url('/api/me'))
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toMatch(/^pokeworld_visitor=[0-9a-f-]{36}/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Max-Age=31536000/i)
    expect(cookie).not.toMatch(/Secure/i) // non-production
    expect(await res.json()).toEqual({ label: `Trainer #${cookie.split('=')[1]!.slice(0, 4)}` })
  })

  it('does not reissue the cookie when a valid one is presented', async () => {
    const v = await newVisitor()
    const res = await v.call('/api/me')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('replaces a malformed cookie with a new UUID', async () => {
    const res = await fetch(url('/api/me'), { headers: { cookie: 'pokeworld_visitor=not-a-uuid' } })
    const value = res.headers.get('set-cookie')!.split(';')[0]!.split('=')[1]!
    expect(value).toMatch(UUID)
  })
})

describe('collection', () => {
  it('starts empty', async () => {
    const v = await newVisitor()
    expect(await v.json('/api/collection')).toEqual([])
  })

  it('PUT catches, and catching twice is a no-op', async () => {
    const v = await newVisitor()
    expect((await v.call('/api/collection/bulbasaur', { method: 'PUT' })).status).toBe(204)
    expect((await v.call('/api/collection/bulbasaur', { method: 'PUT' })).status).toBe(204)
    expect(await v.json('/api/collection')).toEqual(['bulbasaur'])
  })

  it('DELETE removes, and removing a missing Pokemon is a no-op', async () => {
    const v = await newVisitor()
    await v.call('/api/collection/bulbasaur', { method: 'PUT' })
    expect((await v.call('/api/collection/bulbasaur', { method: 'DELETE' })).status).toBe(204)
    expect((await v.call('/api/collection/bulbasaur', { method: 'DELETE' })).status).toBe(204)
    expect(await v.json('/api/collection')).toEqual([])
  })

  it('lower-cases names', async () => {
    const v = await newVisitor()
    await v.call('/api/collection/Bulbasaur', { method: 'PUT' })
    expect(await v.json('/api/collection')).toEqual(['bulbasaur'])
  })

  it.each(['bad_name', 'has.dot', 'a'.repeat(101), 'sp%20ace'])('rejects invalid name %s with 400', async (name) => {
    const v = await newVisitor()
    expect((await v.call(`/api/collection/${name}`, { method: 'PUT' })).status).toBe(400)
    expect((await v.call(`/api/collection/${name}`, { method: 'DELETE' })).status).toBe(400)
  })

  it('DELETE /api/collection resets every row for the visitor', async () => {
    const v = await newVisitor()
    await v.call('/api/collection/bulbasaur', { method: 'PUT' })
    await v.call('/api/collection/lotad', { method: 'PUT' })
    expect((await v.call('/api/collection', { method: 'DELETE' })).status).toBe(204)
    expect(await v.json('/api/collection')).toEqual([])
  })
})

describe('tenancy', () => {
  it("keeps visitors' collections private", async () => {
    const a = await newVisitor()
    const b = await newVisitor()
    expect(a.cookie).not.toEqual(b.cookie)

    await a.call('/api/collection/bulbasaur', { method: 'PUT' })
    expect(await b.json('/api/collection')).toEqual([])
    expect(await a.json('/api/collection')).toEqual(['bulbasaur'])
  })

  it("never lets B's remove or reset change A's rows", async () => {
    const a = await newVisitor()
    const b = await newVisitor()
    await a.call('/api/collection/bulbasaur', { method: 'PUT' })
    await b.call('/api/collection/lotad', { method: 'PUT' })

    await b.call('/api/collection/bulbasaur', { method: 'DELETE' })
    expect(await a.json('/api/collection')).toEqual(['bulbasaur'])

    await b.call('/api/collection', { method: 'DELETE' })
    expect(await a.json('/api/collection')).toEqual(['bulbasaur'])
    expect(await b.json('/api/collection')).toEqual([])
  })

  it('gives each visitor a different label', async () => {
    const a = await newVisitor()
    const b = await newVisitor()
    const [la, lb] = await Promise.all([a.json<{ label: string }>('/api/me'), b.json<{ label: string }>('/api/me')])
    expect(la.label).toMatch(/^Trainer #[0-9a-f]{4}$/)
    expect(la.label).not.toEqual(lb.label)
  })
})

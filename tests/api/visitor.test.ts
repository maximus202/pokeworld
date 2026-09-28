import { describe, expect, it } from 'vitest'
import { baseUrl, visitor } from './helpers'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('visitor identity', () => {
  it('issues an httpOnly, SameSite=Lax cookie on the first request', async () => {
    const res = await fetch(`${baseUrl()}/api/me`)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^pokeworld_visitor=[0-9a-f-]{36}/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('does not set a new cookie when a valid one is sent', async () => {
    const v = visitor()
    await v.request('/api/me')
    const res = await v.request('/api/me')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('replaces a malformed cookie with a fresh UUID', async () => {
    const v = visitor('not-a-uuid')
    await v.request('/api/me')
    expect(v.id).toMatch(UUID)
  })

  it('returns the same short label for the same cookie', async () => {
    const v = visitor()
    const first = await v.json<{ label: string }>('/api/me')
    const second = await v.json<{ label: string }>('/api/me')
    expect(first.body.label).toBe(`Trainer #${v.id!.slice(0, 4)}`)
    expect(second.body.label).toBe(first.body.label)
  })

  it('gives different visitors different ids', async () => {
    const a = visitor()
    const b = visitor()
    await a.request('/api/me')
    await b.request('/api/me')
    expect(a.id).not.toBe(b.id)
  })

  it('renders the same label on the server as the cookie it issues (first visit)', async () => {
    const res = await fetch(`${baseUrl()}/`)
    const id = res.headers.get('set-cookie')!.match(/pokeworld_visitor=([^;]+)/)![1]
    const html = await res.text()
    expect(html).toContain(`Trainer #${id.slice(0, 4)}`)
  })
})

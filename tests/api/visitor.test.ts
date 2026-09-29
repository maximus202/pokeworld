import { describe, expect, it } from 'vitest'
import { VISITOR_COOKIE } from '../../server/utils/visitor'
import { baseUrl, cookieIn, visitor } from './helpers'

// Stricter than what the middleware accepts: it must only ever *issue* v4 UUIDs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const setCookie = (res: Response) => res.headers.get('set-cookie') ?? ''
const withCookie = (value: string) =>
  fetch(`${baseUrl()}/api/me`, { headers: { cookie: `${VISITOR_COOKIE}=${value}` } })

describe('visitor cookie', () => {
  it('issues a UUID cookie to a request that has none', async () => {
    const res = await fetch(`${baseUrl()}/api/me`)
    expect(cookieIn(res)).toMatch(UUID)
  })

  it('sets httpOnly, SameSite=Lax, Path=/ and a one-year lifetime', async () => {
    const cookie = setCookie(await fetch(`${baseUrl()}/api/me`))
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//i)
    expect(cookie).toMatch(/Max-Age=31536000/i)
  })

  it('is not Secure over plain http, so it works on localhost', async () => {
    expect(setCookie(await fetch(`${baseUrl()}/api/me`))).not.toMatch(/Secure/i)
  })

  it('is Secure when the request arrived over https behind a proxy', async () => {
    const res = await fetch(`${baseUrl()}/api/me`, { headers: { 'x-forwarded-proto': 'https' } })
    expect(setCookie(res)).toMatch(/Secure/i)
  })

  it('does not set a new cookie when a valid one is sent', async () => {
    const v = visitor()
    await v.request('/api/me')
    const again = await v.request('/api/me')
    expect(again.headers.get('set-cookie')).toBeNull()
  })

  it.each([
    ['empty', ''],
    ['not a UUID', 'abc'],
    ['almost a UUID', '12345678-1234-1234-1234-12345678901'],
    ['a UUID with trailing junk', '12345678-1234-1234-1234-123456789012xyz'],
  ])('replaces a malformed cookie (%s) with a new UUID', async (_name, value) => {
    const id = cookieIn(await withCookie(value))
    expect(id).toMatch(UUID)
    expect(id).not.toBe(value)
  })

  it('gives different browsers different IDs', async () => {
    const a = visitor()
    const b = visitor()
    await a.request('/api/me')
    await b.request('/api/me')
    expect(a.id).not.toBe(b.id)
  })

  it.each(['/__nuxt_error', '/favicon.ico', '/robots.txt', '/.well-known/security.txt'])(
    'does not issue a cookie for %s',
    async (path) => {
      const res = await fetch(`${baseUrl()}${path}`, { redirect: 'manual' })
      expect(res.headers.get('set-cookie')).toBeNull()
    },
  )

  it('still issues a cookie for an /api route that does not exist', async () => {
    const res = await fetch(`${baseUrl()}/api/nope`)
    expect(cookieIn(res)).toMatch(UUID)
  })

  it('forwards the new ID to the render: unrelated cookies are kept and the bad visitor cookie is replaced', async () => {
    const res = await fetch(baseUrl(), { headers: { cookie: `theme=dark; ${VISITOR_COOKIE}=abc` } })
    const id = cookieIn(res)
    expect(id).toMatch(UUID)
    expect(await res.text()).toContain(`Trainer #${id!.slice(0, 4)}`)
  })
})
